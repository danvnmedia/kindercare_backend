import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { computeDiff } from "@/application/audit";
import {
  Guardian,
  UpdateGuardianData,
} from "@/domain/user-management/entities/guardian.entity";
import { User } from "@/domain/user-management/user.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { GuardianRepository } from "../../ports/guardian.repository";

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

@Injectable()
export class UpdateGuardianUseCase {
  private readonly logger = new Logger(UpdateGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    private readonly unitOfWork: UnitOfWorkPort,
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

    // Step 2: Linked identity fields are global and require a separate flow.
    this.rejectLinkedIdentityFieldChanges(guardian, input);

    // Step 3: Check uniqueness (email and phone) - campus-scoped
    if (input.email && input.email !== guardian.email) {
      await this.checkEmailUniqueness(guardian.campusId, input.email, id);
    }
    if (input.phoneNumber && input.phoneNumber !== guardian.phoneNumber) {
      await this.checkPhoneUniqueness(guardian.campusId, input.phoneNumber, id);
    }

    // Step 4: Update DB only. Global identity changes use a separate flow.
    return await this.updateDbOnly(guardian, input, currentUser);
  }

  private rejectLinkedIdentityFieldChanges(
    guardian: Guardian,
    input: UpdateGuardianInput,
  ): void {
    if (!guardian.userId) {
      return;
    }

    const changedFields = [
      input.email !== undefined && input.email !== guardian.email
        ? "email"
        : null,
      input.phoneNumber !== undefined &&
      input.phoneNumber !== guardian.phoneNumber
        ? "phoneNumber"
        : null,
      input.fullName !== undefined && input.fullName !== guardian.fullName
        ? "fullName"
        : null,
    ].filter((field): field is string => field !== null);

    if (changedFields.length === 0) {
      return;
    }

    throw new ConflictException({
      code: "SHARED_IDENTITY_UPDATE_RESTRICTED",
      message: `Linked guardian identity fields cannot be changed through profile update: ${changedFields.join(", ")}`,
    });
  }

  /**
   * Update DB only. Global identity changes use a separate flow.
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
