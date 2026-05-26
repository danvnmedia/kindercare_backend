import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { computeDiff } from "@/application/audit";
import {
  Staff,
  UpdateStaffData,
} from "@/domain/user-management/entities/staff.entity";
import { User } from "@/domain/user-management/user.entity";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { RoleRepository } from "../../ports/role.repository";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { UserRepository } from "../../ports/user.repository";

export interface UpdateStaffInput extends UpdateStaffData {
  campusId: string; // Required for campus verification
  staffTypeId?: string | null;
}

interface ClerkChanges {
  hasChanges: boolean;
  email?: string;
  phoneNumber?: string;
  fullName?: string;
}

interface ClerkOriginalValues {
  email: string;
  phoneNumber: string;
  fullName: string;
}

type RoleProvenanceEntry = { roleId: string; viaStaffTypeId: string };

// Audit `context` shape for EDIT_STAFF_PROFILE. The role arrays are visible
// in the timeline alongside the profile diff — see
// @doc/specs/tracked-grant-revocation (D3 single audit event, D5 manual-wins)
// and @doc/references/audit-event-context-shapes. The index signature lets
// this typed shape flow into the port's wider `Record<string, unknown>`
// jsonb contract without an `as` cast at the call site.
interface EditStaffProfileContext {
  actorName: string | null;
  rolesGranted: RoleProvenanceEntry[];
  rolesRevoked: RoleProvenanceEntry[];
  [key: string]: unknown;
}

interface TrackedGrantSync {
  rolesGranted: RoleProvenanceEntry[];
  rolesRevoked: RoleProvenanceEntry[];
}

@Injectable()
export class UpdateStaffUseCase {
  private readonly logger = new Logger(UpdateStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(
    id: string,
    input: UpdateStaffInput,
    currentUser: User,
  ): Promise<Staff> {
    this.logger.log(`Updating staff: ${id} in campus ${input.campusId}`);

    // Step 1: Find existing staff
    const staff = await this.staffRepository.findById(id);
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    // Step 2: Verify staff belongs to the specified campus
    if (staff.campusId !== input.campusId) {
      throw new NotFoundException(
        `Staff with ID ${id} not found in this campus`,
      );
    }

    // Step 3: Check uniqueness (email and phone) - campus-scoped
    if (input.email && input.email !== staff.email) {
      await this.checkEmailUniqueness(staff.campusId, input.email, id);
    }
    if (input.phoneNumber && input.phoneNumber !== staff.phoneNumber) {
      await this.checkPhoneUniqueness(staff.campusId, input.phoneNumber, id);
    }

    // Step 4: Validate new staffTypeId if provided
    let newDefaultRoleId: string | null = null;
    if (
      input.staffTypeId !== undefined &&
      input.staffTypeId !== staff.staffTypeId
    ) {
      if (input.staffTypeId !== null) {
        const newStaffType = await this.staffTypeRepository.findById(
          input.staffTypeId,
        );
        if (!newStaffType) {
          throw new NotFoundException(
            `Staff type with ID ${input.staffTypeId} not found`,
          );
        }
        if (newStaffType.isArchived) {
          throw new BadRequestException(
            `Staff type ${newStaffType.name} is archived`,
          );
        }
        if (newStaffType.campusId !== staff.campusId) {
          throw new BadRequestException(
            `Staff type ${newStaffType.name} does not belong to staff's campus`,
          );
        }
        newDefaultRoleId = newStaffType.defaultRoleId;
        this.logger.log(
          `New staff type validated: ${newStaffType.name}, defaultRoleId: ${newDefaultRoleId}`,
        );
      }
    }

    // Step 4b: Pre-resolve `oldDefaultRoleId` BEFORE entering the UoW so the
    // audit payload can name what was revoked. `staff.changeStaffType()` only
    // mutates the FK on the entity — the related role row's ID is not
    // reconstructable inside the transaction.
    // (@doc/specs/tracked-grant-revocation#use-case-flow-change-updatestaffusecase)
    const oldDefaultRoleId = await this.resolveOldDefaultRoleId(
      staff.staffTypeId,
      input.staffTypeId,
    );

    // Step 5: Detect Clerk-relevant changes (email, phone, fullName)
    const clerkChanges = this.detectClerkChanges(staff, input);

    // Step 6: If has User account AND has Clerk changes -> Saga pattern
    if (staff.userId && clerkChanges.hasChanges) {
      return await this.updateWithClerkSync(
        staff,
        input,
        clerkChanges,
        oldDefaultRoleId,
        newDefaultRoleId,
        currentUser,
      );
    }

    // Step 7: Otherwise, just update DB with transaction
    return await this.updateDbOnly(
      staff,
      input,
      oldDefaultRoleId,
      newDefaultRoleId,
      currentUser,
    );
  }

  /**
   * Look up the old StaffType's `defaultRoleId` when a swap is about to
   * happen. Returns `null` when no swap is intended or no old type exists.
   * Caller does this OUTSIDE the UoW so the audit payload can be constructed
   * without making the transaction wait on a read.
   */
  private async resolveOldDefaultRoleId(
    oldStaffTypeId: string | null,
    nextStaffTypeId: string | null | undefined,
  ): Promise<string | null> {
    if (!oldStaffTypeId) return null;
    if (nextStaffTypeId === undefined) return null;
    if (nextStaffTypeId === oldStaffTypeId) return null;

    const oldStaffType =
      await this.staffTypeRepository.findById(oldStaffTypeId);
    return oldStaffType?.defaultRoleId ?? null;
  }

  /**
   * Detect which fields need to be synced with Clerk
   */
  private detectClerkChanges(
    staff: Staff,
    input: UpdateStaffInput,
  ): ClerkChanges {
    const changes: ClerkChanges = { hasChanges: false };

    if (input.email !== undefined && input.email !== staff.email) {
      changes.email = input.email;
      changes.hasChanges = true;
    }
    if (
      input.phoneNumber !== undefined &&
      input.phoneNumber !== staff.phoneNumber
    ) {
      changes.phoneNumber = input.phoneNumber;
      changes.hasChanges = true;
    }
    if (input.fullName !== undefined && input.fullName !== staff.fullName) {
      changes.fullName = input.fullName;
      changes.hasChanges = true;
    }

    return changes;
  }

  /**
   * Update with Clerk sync using Saga pattern
   * Flow: Clerk first -> DB transaction -> Revert Clerk on failure
   */
  private async updateWithClerkSync(
    staff: Staff,
    input: UpdateStaffInput,
    clerkChanges: ClerkChanges,
    oldDefaultRoleId: string | null,
    newDefaultRoleId: string | null,
    currentUser: User,
  ): Promise<Staff> {
    // Get User to find clerkUid
    const user = await this.userRepository.findById(staff.userId!);
    if (!user) {
      this.logger.warn(
        `User not found for staff ${staff.id}, falling back to DB-only update`,
      );
      return await this.updateDbOnly(
        staff,
        input,
        oldDefaultRoleId,
        newDefaultRoleId,
        currentUser,
      );
    }

    // Store original values for potential rollback
    const originalValues: ClerkOriginalValues = {
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      fullName: staff.fullName,
    };

    const oldStaffTypeId = staff.staffTypeId;

    this.logger.log(
      `Updating Clerk user ${user.clerkUid} for staff ${staff.id}`,
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
      // Snapshot before/after for the EDIT_STAFF_PROFILE audit diff.
      const beforeAudit = pickStaffAuditFields(staff);
      staff.updateProfile(input);

      // Handle staffTypeId change
      if (
        input.staffTypeId !== undefined &&
        input.staffTypeId !== oldStaffTypeId
      ) {
        staff.changeStaffType(input.staffTypeId);
      }

      const afterAudit = pickStaffAuditFields(staff);
      const diff = computeDiff(beforeAudit, afterAudit);

      const updatedStaff = await this.unitOfWork.run(async (tx) => {
        // Update staff in transaction
        await tx.updateStaff(staff.id, {
          fullName: staff.fullName,
          email: staff.email,
          phoneNumber: staff.phoneNumber,
          staffTypeId: staff.staffTypeId,
          address: staff.address,
          dateOfBirth: staff.dateOfBirth,
          gender: staff.gender,
          startDate: staff.startDate,
          isArchived: staff.isArchived,
          updatedAt: staff.updatedAt,
        });

        // Sync tracked role grants atomically with the staff update — revoke
        // the old type's grant, insert the new one with provenance, and
        // surface the result for the audit payload.
        const { rolesGranted, rolesRevoked } = await this.syncTrackedGrants(
          tx,
          staff,
          oldStaffTypeId,
          oldDefaultRoleId,
          input.staffTypeId,
          newDefaultRoleId,
        );

        if (Object.keys(diff.after).length > 0) {
          const context: EditStaffProfileContext = {
            actorName: currentUser.profile?.fullName ?? null,
            rolesGranted,
            rolesRevoked,
          };
          await tx.recordAudit({
            actorId: currentUser.id,
            action: "EDIT_STAFF_PROFILE",
            targetType: "staff",
            targetId: staff.id,
            campusId: staff.campusId,
            context,
            beforeValue: diff.before,
            afterValue: diff.after,
          });
        }

        this.logger.log(`Staff updated in DB: ${staff.id}`);
        return staff;
      });

      this.logger.log(`Staff updated successfully: ${staff.id}`);
      return updatedStaff;
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
        `Failed to update staff: ${dbError.message}`,
        dbError.stack,
      );
      throw new BadRequestException(
        `Failed to update staff: ${dbError.message}`,
      );
    }
  }

  /**
   * Update DB only (no Clerk sync needed)
   */
  private async updateDbOnly(
    staff: Staff,
    input: UpdateStaffInput,
    oldDefaultRoleId: string | null,
    newDefaultRoleId: string | null,
    currentUser: User,
  ): Promise<Staff> {
    const oldStaffTypeId = staff.staffTypeId;

    try {
      // Snapshot before/after for the EDIT_STAFF_PROFILE audit diff.
      const beforeAudit = pickStaffAuditFields(staff);
      staff.updateProfile(input);

      // Handle staffTypeId change
      if (
        input.staffTypeId !== undefined &&
        input.staffTypeId !== oldStaffTypeId
      ) {
        staff.changeStaffType(input.staffTypeId);
      }

      const afterAudit = pickStaffAuditFields(staff);
      const diff = computeDiff(beforeAudit, afterAudit);

      const updatedStaff = await this.unitOfWork.run(async (tx) => {
        // Update staff in transaction
        await tx.updateStaff(staff.id, {
          fullName: staff.fullName,
          email: staff.email,
          phoneNumber: staff.phoneNumber,
          staffTypeId: staff.staffTypeId,
          address: staff.address,
          dateOfBirth: staff.dateOfBirth,
          gender: staff.gender,
          startDate: staff.startDate,
          isArchived: staff.isArchived,
          updatedAt: staff.updatedAt,
        });

        // Sync tracked role grants atomically with the staff update — revoke
        // the old type's grant, insert the new one with provenance, and
        // surface the result for the audit payload.
        const { rolesGranted, rolesRevoked } = await this.syncTrackedGrants(
          tx,
          staff,
          oldStaffTypeId,
          oldDefaultRoleId,
          input.staffTypeId,
          newDefaultRoleId,
        );

        if (Object.keys(diff.after).length > 0) {
          const context: EditStaffProfileContext = {
            actorName: currentUser.profile?.fullName ?? null,
            rolesGranted,
            rolesRevoked,
          };
          await tx.recordAudit({
            actorId: currentUser.id,
            action: "EDIT_STAFF_PROFILE",
            targetType: "staff",
            targetId: staff.id,
            campusId: staff.campusId,
            context,
            beforeValue: diff.before,
            afterValue: diff.after,
          });
        }

        this.logger.log(`Staff updated (DB only): ${staff.id}`);
        return staff;
      });

      return updatedStaff;
    } catch (error) {
      this.logger.error(
        `Failed to update staff: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Sync tracked role grants for a staff-type swap inside the active UoW.
   *
   * Behavioral contract (@doc/specs/tracked-grant-revocation):
   * - When `staff.userId` is null → no-op (spec AC-13).
   * - When `nextStaffTypeId` is `undefined` or equals `oldStaffTypeId` → no-op
   *   (caller didn't ask for a swap).
   * - When `oldStaffTypeId` is non-null → delete every `user_roles` row with
   *   provenance `oldStaffTypeId`. The row is dropped regardless of whether
   *   we can audit-name it; `rolesRevoked` only gains an entry when
   *   `oldDefaultRoleId` is known (the spec mirrors this conditional push).
   * - When `nextStaffTypeId` and `newDefaultRoleId` are both non-null →
   *   insert one tracked row, then push to `rolesGranted` only if the insert
   *   actually committed (D5: a colliding manual grant returns count=0 and
   *   the auto-assign stays silent).
   *
   * Manual grants (provenance NULL) are never touched — SQL semantics (D4).
   */
  private async syncTrackedGrants(
    tx: TransactionContext,
    staff: Staff,
    oldStaffTypeId: string | null,
    oldDefaultRoleId: string | null,
    nextStaffTypeId: string | null | undefined,
    newDefaultRoleId: string | null,
  ): Promise<TrackedGrantSync> {
    const rolesGranted: RoleProvenanceEntry[] = [];
    const rolesRevoked: RoleProvenanceEntry[] = [];

    if (!staff.hasUserAccount()) {
      return { rolesGranted, rolesRevoked };
    }

    if (
      nextStaffTypeId === undefined ||
      nextStaffTypeId === oldStaffTypeId
    ) {
      return { rolesGranted, rolesRevoked };
    }

    const userId = staff.userId!;

    if (oldStaffTypeId) {
      await tx.revokeRolesByProvenance(userId, oldStaffTypeId);
      if (oldDefaultRoleId) {
        rolesRevoked.push({
          roleId: oldDefaultRoleId,
          viaStaffTypeId: oldStaffTypeId,
        });
      }
      this.logger.log(
        `Revoked tracked grants for user ${userId} from staffType ${oldStaffTypeId}`,
      );
    }

    if (nextStaffTypeId && newDefaultRoleId) {
      // Defensive: stale FK could point at a role that no longer exists.
      const newRole = await this.roleRepository.findById(newDefaultRoleId);
      if (!newRole) {
        this.logger.warn(
          `Default role ${newDefaultRoleId} not found, skipping role assignment for user ${userId}`,
        );
        return { rolesGranted, rolesRevoked };
      }

      const inserted = await tx.assignRoles(userId, [
        {
          roleId: newDefaultRoleId,
          campusId: staff.campusId,
          grantedViaStaffTypeId: nextStaffTypeId,
        },
      ]);
      if (inserted > 0) {
        rolesGranted.push({
          roleId: newDefaultRoleId,
          viaStaffTypeId: nextStaffTypeId,
        });
        this.logger.log(
          `Assigned default role ${newDefaultRoleId} to user ${userId} in campus ${staff.campusId} (via staffType ${nextStaffTypeId})`,
        );
      } else {
        // D5 conflict: a pre-existing manual grant kept its row.
        this.logger.log(
          `Tracked-grant insert skipped — manual row already holds (user ${userId}, role ${newDefaultRoleId}, campus ${staff.campusId})`,
        );
      }
    }

    return { rolesGranted, rolesRevoked };
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
        revertData.email = originalValues.email;
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
    const existingByEmail = await this.staffRepository.findByEmailInCampus(
      campusId,
      email,
    );
    if (existingByEmail && existingByEmail.id !== excludeId) {
      throw new ConflictException(
        `Staff with email ${email} already exists in this campus`,
      );
    }
  }

  private async checkPhoneUniqueness(
    campusId: string,
    phoneNumber: string,
    excludeId: string,
  ): Promise<void> {
    const existingByPhone =
      await this.staffRepository.findByPhoneNumberInCampus(
        campusId,
        phoneNumber,
      );
    if (existingByPhone && existingByPhone.id !== excludeId) {
      throw new ConflictException(
        `Staff with phone number ${phoneNumber} already exists in this campus`,
      );
    }
  }
}

function pickStaffAuditFields(s: Staff) {
  return {
    fullName: s.fullName,
    email: s.email,
    phoneNumber: s.phoneNumber,
    staffTypeId: s.staffTypeId,
    address: s.address,
    dateOfBirth: s.dateOfBirth,
    gender: s.gender,
    startDate: s.startDate,
  };
}
