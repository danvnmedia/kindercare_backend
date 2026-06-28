import { IdentityPort } from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { computeDiff } from "@/application/audit";
import {
  Guardian,
  UpdateGuardianData,
} from "@/domain/user-management/entities/guardian.entity";
import { User } from "@/domain/user-management/user.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";

export interface UpdateGuardianInput {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  occupation?: string;
  workAddress?: string;
}

interface ClerkChanges {
  hasChanges: boolean;
  email?: string;
  phoneNumber?: string;
  fullName?: string;
}

interface ClerkOriginalValues {
  email: string | null;
  phoneNumber: string;
  fullName: string;
}

@Injectable()
export class UpdateGuardianUseCase {
  private readonly logger = new Logger(UpdateGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(
    id: string,
    input: UpdateGuardianInput,
    currentUser: User,
  ): Promise<Guardian> {
    this.logger.log(`Updating guardian: ${id}`);

    // Step 1: Find existing guardian
    const guardian = await this.guardianRepository.findById(id);
    if (!guardian) {
      throw new NotFoundException(`Guardian with ID ${id} not found`);
    }

    // Step 2: Check uniqueness (email and phone) - campus-scoped
    if (input.email && input.email !== guardian.email) {
      await this.checkEmailUniqueness(guardian.campusId, input.email, id);
    }
    if (input.phoneNumber && input.phoneNumber !== guardian.phoneNumber) {
      await this.checkPhoneUniqueness(guardian.campusId, input.phoneNumber, id);
    }

    // Step 3: Detect Clerk-relevant changes
    const clerkChanges = this.detectClerkChanges(guardian, input);

    // Step 4: If has User account AND has Clerk changes → Saga pattern
    if (guardian.userId && clerkChanges.hasChanges) {
      return await this.updateWithClerkSync(
        guardian,
        input,
        clerkChanges,
        currentUser,
      );
    }

    // Step 5: Otherwise, just update DB
    return await this.updateDbOnly(guardian, input, currentUser);
  }

  /**
   * Detect which fields need to be synced with Clerk
   */
  private detectClerkChanges(
    guardian: Guardian,
    input: UpdateGuardianInput,
  ): ClerkChanges {
    const changes: ClerkChanges = { hasChanges: false };

    if (input.email !== undefined && input.email !== guardian.email) {
      changes.email = input.email;
      changes.hasChanges = true;
    }
    if (
      input.phoneNumber !== undefined &&
      input.phoneNumber !== guardian.phoneNumber
    ) {
      changes.phoneNumber = input.phoneNumber;
      changes.hasChanges = true;
    }
    if (input.fullName !== undefined && input.fullName !== guardian.fullName) {
      changes.fullName = input.fullName;
      changes.hasChanges = true;
    }

    return changes;
  }

  /**
   * Update with Clerk sync using Saga pattern
   * Flow: Clerk first → DB transaction → Revert Clerk on failure
   */
  private async updateWithClerkSync(
    guardian: Guardian,
    input: UpdateGuardianInput,
    clerkChanges: ClerkChanges,
    currentUser: User,
  ): Promise<Guardian> {
    // Get User to find clerkUid
    const user = await this.userRepository.findById(guardian.userId!);
    if (!user) {
      this.logger.warn(
        `User not found for guardian ${guardian.id}, falling back to DB-only update`,
      );
      return await this.updateDbOnly(guardian, input, currentUser);
    }

    // Store original values for potential rollback
    const originalValues: ClerkOriginalValues = {
      email: guardian.email,
      phoneNumber: guardian.phoneNumber,
      fullName: guardian.fullName,
    };

    this.logger.log(
      `Updating Clerk user ${user.clerkUid} for guardian ${guardian.id}`,
    );

    // Update Clerk FIRST (external service)
    try {
      await this.identityPort.updateUser(user.clerkUid, {
        email: clerkChanges.email,
        phoneNumber: clerkChanges.phoneNumber,
        fullName: clerkChanges.fullName,
      });
      this.logger.log(`Clerk user updated successfully: ${user.clerkUid}`);
    } catch (clerkError) {
      this.logger.error(
        `Failed to update Clerk user: ${clerkError.message}`,
        clerkError.stack,
      );
      throw new BadRequestException(
        `Failed to update identity: ${clerkError.message}`,
      );
    }

    try {
      // Snapshot before/after for the EDIT_GUARDIAN_PROFILE audit diff
      // (Scenario 3 — only changed fields land in before/after_value).
      const beforeAudit = pickGuardianAuditFields(guardian);
      const updateData = this.prepareUpdateData(input);
      guardian.updateProfile(updateData);
      const afterAudit = pickGuardianAuditFields(guardian);
      const diff = computeDiff(beforeAudit, afterAudit);

      const updatedGuardian = await this.unitOfWork.run(async (tx) => {
        await tx.updateGuardian(guardian.id, {
          fullName: guardian.fullName,
          email: guardian.email,
          phoneNumber: guardian.phoneNumber,
          address: guardian.address,
          dateOfBirth: guardian.dateOfBirth,
          gender: guardian.gender,
          occupation: guardian.occupation,
          workAddress: guardian.workAddress,
          isArchived: guardian.isArchived,
          updatedAt: guardian.updatedAt,
        });

        if (Object.keys(diff.after).length > 0) {
          await tx.recordAudit({
            actorId: currentUser.id,
            action: "EDIT_GUARDIAN_PROFILE",
            targetType: "guardian",
            targetId: guardian.id,
            campusId: guardian.campusId,
            context: { actorName: currentUser.profile?.fullName ?? null },
            beforeValue: diff.before,
            afterValue: diff.after,
          });
        }

        this.logger.log(`Guardian updated in DB: ${guardian.id}`);
        return guardian;
      });

      this.logger.log(`Guardian updated successfully: ${guardian.id}`);
      return updatedGuardian;
    } catch (dbError) {
      // Compensate: Revert Clerk to original values
      this.logger.error(
        `DB transaction failed, compensating by reverting Clerk: ${user.clerkUid}`,
      );
      await this.revertClerkChanges(
        user.clerkUid,
        originalValues,
        clerkChanges,
      );

      this.logger.error(
        `Failed to update guardian: ${dbError.message}`,
        dbError.stack,
      );
      throw new BadRequestException(
        `Failed to update guardian: ${dbError.message}`,
      );
    }
  }

  /**
   * Update DB only (no Clerk sync needed).
   *
   * Persists through `unitOfWork.run` to align with the unified UoW convention
   * (@doc/patterns/unit-of-work-pattern). This sets up the world @task-e5v0wm
   * assumes: every profile-edit mutation participates in a transaction so the
   * audit `tx.recordAudit` emit can join the same boundary (D4 same-tx).
   */
  private async updateDbOnly(
    guardian: Guardian,
    input: UpdateGuardianInput,
    currentUser: User,
  ): Promise<Guardian> {
    try {
      // Snapshot before/after for the EDIT_GUARDIAN_PROFILE audit diff.
      const beforeAudit = pickGuardianAuditFields(guardian);
      const updateData = this.prepareUpdateData(input);
      guardian.updateProfile(updateData);
      const afterAudit = pickGuardianAuditFields(guardian);
      const diff = computeDiff(beforeAudit, afterAudit);

      await this.unitOfWork.run(async (tx) => {
        await tx.updateGuardian(guardian.id, {
          fullName: guardian.fullName,
          email: guardian.email,
          phoneNumber: guardian.phoneNumber,
          address: guardian.address,
          dateOfBirth: guardian.dateOfBirth,
          gender: guardian.gender,
          occupation: guardian.occupation,
          workAddress: guardian.workAddress,
          isArchived: guardian.isArchived,
          updatedAt: guardian.updatedAt,
        });

        if (Object.keys(diff.after).length > 0) {
          await tx.recordAudit({
            actorId: currentUser.id,
            action: "EDIT_GUARDIAN_PROFILE",
            targetType: "guardian",
            targetId: guardian.id,
            campusId: guardian.campusId,
            context: { actorName: currentUser.profile?.fullName ?? null },
            beforeValue: diff.before,
            afterValue: diff.after,
          });
        }
      });

      this.logger.log(`Guardian updated (DB only): ${guardian.id}`);
      return guardian;
    } catch (error) {
      this.logger.error(
        `Failed to update guardian: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Prepare update data from input
   */
  private prepareUpdateData(input: UpdateGuardianInput): UpdateGuardianData {
    const updateData: UpdateGuardianData = {};

    if (input.fullName !== undefined) updateData.fullName = input.fullName;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.phoneNumber !== undefined)
      updateData.phoneNumber = input.phoneNumber;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.dateOfBirth !== undefined)
      updateData.dateOfBirth = input.dateOfBirth;
    if (input.gender !== undefined) updateData.gender = input.gender;
    if (input.occupation !== undefined)
      updateData.occupation = input.occupation;
    if (input.workAddress !== undefined)
      updateData.workAddress = input.workAddress;

    return updateData;
  }

  /**
   * Compensation: Revert Clerk changes to original values
   */
  private async revertClerkChanges(
    clerkUid: string,
    originalValues: ClerkOriginalValues,
    appliedChanges: ClerkChanges,
  ): Promise<void> {
    try {
      const revertData: {
        email?: string;
        phoneNumber?: string;
        fullName?: string;
      } = {};

      // Only revert fields that were actually changed
      if (appliedChanges.email !== undefined) {
        revertData.email = originalValues.email || undefined;
      }
      if (appliedChanges.phoneNumber !== undefined) {
        revertData.phoneNumber = originalValues.phoneNumber;
      }
      if (appliedChanges.fullName !== undefined) {
        revertData.fullName = originalValues.fullName;
      }

      await this.identityPort.updateUser(clerkUid, revertData);
      this.logger.log(
        `Compensation successful: Clerk reverted for ${clerkUid}`,
      );
    } catch (compensationError) {
      // Log but don't throw - compensation is best effort
      this.logger.error(
        `Compensation FAILED: Could not revert Clerk user ${clerkUid}. Manual fix required.`,
        compensationError.stack,
      );
    }
  }

  private async checkEmailUniqueness(
    campusId: string,
    email: string,
    excludeId: string,
  ): Promise<void> {
    const existingByEmail = await this.guardianRepository.findByEmailInCampus(
      campusId,
      email,
    );
    if (existingByEmail && existingByEmail.id !== excludeId) {
      throw new ConflictException(
        `Guardian with email ${email} already exists`,
      );
    }
  }

  private async checkPhoneUniqueness(
    campusId: string,
    phoneNumber: string,
    excludeId: string,
  ): Promise<void> {
    const existingByPhone =
      await this.guardianRepository.findByPhoneNumberInCampus(
        campusId,
        phoneNumber,
      );
    if (existingByPhone && existingByPhone.id !== excludeId) {
      throw new ConflictException(
        `Guardian with phone number ${phoneNumber} already exists`,
      );
    }
  }
}

function pickGuardianAuditFields(g: Guardian) {
  return {
    fullName: g.fullName,
    email: g.email,
    phoneNumber: g.phoneNumber,
    address: g.address,
    dateOfBirth: g.dateOfBirth,
    gender: g.gender,
    occupation: g.occupation,
    workAddress: g.workAddress,
  };
}
