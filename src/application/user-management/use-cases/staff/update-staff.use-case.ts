import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { computeDiff } from "@/application/audit";
import {
  Staff,
  StaffTypeSnapshot,
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
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { UserRepository } from "../../ports/user.repository";

export interface UpdateStaffInput extends UpdateStaffData {
  campusId: string; // Required for campus verification
  /**
   * Full-set replacement of the staff's types. Omit the field to leave types
   * unchanged. Min 1 invariant enforced upstream by the DTO (`@ArrayMinSize(1)`
   * when present) and downstream by the entity (`Staff.setStaffTypes`).
   * Set-diff against `staff.staffTypes` drives provenance-aware revoke +
   * assignment under D-extra-2 / D-extra-3 of
   * @doc/specs/staff-multi-type-refactor.
   */
  staffTypeIds?: string[];
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
// @doc/specs/tracked-grant-revocation (D3 single audit event) and
// @doc/references/audit-event-context-shapes. The index signature lets this
// typed shape flow into the port's wider `Record<string, unknown>` jsonb
// contract without an `as` cast at the call site.
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

/**
 * Pre-resolved staff-type snapshot. `defaultRoleId` drives auto-grant /
 * auto-revoke decisions; `name` hydrates the entity's read-side
 * `staffTypes` array when the set changes.
 */
interface ResolvedStaffType {
  defaultRoleId: string | null;
  name: string;
}

/**
 * Pre-UoW resolution of a staff-type swap. Populated when the caller supplies
 * `input.staffTypeIds`; `null` otherwise (no swap intent → no entity mutation
 * and no `tx.replaceStaffTypes` call).
 *
 * - `added` / `removed`: set diff against `staff.staffTypes` at call time.
 * - `newIds`: the target set in caller-supplied order; persisted via
 *   `tx.replaceStaffTypes`.
 * - `newSnapshots`: `{id, name}` projections for the target set, fed to
 *   `Staff.setStaffTypes` so the entity's read-side reflects the swap before
 *   `pickStaffAuditFields` snapshots `staffTypeIds`.
 * - `resolved`: keyed by type id, covers BOTH the added and removed sides
 *   (added → validated; removed → best-effort lookup for audit name +
 *   default-role attribution).
 */
interface StaffTypeDiff {
  added: string[];
  removed: string[];
  newIds: string[];
  newSnapshots: StaffTypeSnapshot[];
  resolved: Map<string, ResolvedStaffType>;
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

    // Step 4: Resolve the staff-type set diff outside the UoW so:
    //  - per-type validation (existence / archived / cross-campus) surfaces
    //    as a 4xx without holding a DB transaction open;
    //  - the audit payload can name what was revoked even after the rows
    //    are gone (D-extra-2 of @doc/specs/staff-multi-type-refactor);
    //  - the entity's read-side can be hydrated with the new snapshots
    //    before `pickStaffAuditFields` snapshots `staffTypeIds`.
    const staffTypeDiff = await this.resolveStaffTypeDiff(staff, input);

    // Step 5: Detect Clerk-relevant changes (email, phone, fullName)
    const clerkChanges = this.detectClerkChanges(staff, input);

    // Step 6: If has User account AND has Clerk changes -> Saga pattern
    if (staff.userId && clerkChanges.hasChanges) {
      return await this.updateWithClerkSync(
        staff,
        input,
        clerkChanges,
        staffTypeDiff,
        currentUser,
      );
    }

    // Step 7: Otherwise, just update DB with transaction
    return await this.updateDbOnly(staff, input, staffTypeDiff, currentUser);
  }

  /**
   * Compute added / removed against `staff.staffTypes` and pre-resolve
   * `defaultRoleId` + `name` for every type touched.
   *
   * Added-side validation enforces 4xx semantics before the UoW opens:
   *   - exists           → NotFoundException
   *   - !archived        → BadRequestException
   *   - same campus      → BadRequestException
   *
   * Removed-side lookups are best-effort: when a removed type is gone (legacy
   * orphan, cross-tenant migration), we drop it silently from `rolesRevoked`
   * but `tx.replaceStaffTypes` + `tx.revokeRolesByProvenance` still clean up
   * by id, so steady state ends consistent.
   *
   * Returns `null` when `input.staffTypeIds` is omitted (no swap intent at
   * all — entity untouched and no join-table writes).
   */
  private async resolveStaffTypeDiff(
    staff: Staff,
    input: UpdateStaffInput,
  ): Promise<StaffTypeDiff | null> {
    if (input.staffTypeIds === undefined) return null;

    const oldIds = new Set(staff.staffTypes.map((t) => t.id));
    const newIdSet = new Set(input.staffTypeIds);
    const added = input.staffTypeIds.filter((id) => !oldIds.has(id));
    const removed = staff.staffTypes
      .map((t) => t.id)
      .filter((id) => !newIdSet.has(id));

    const resolved = new Map<string, ResolvedStaffType>();

    // Validate ADDED side — bad input must surface BEFORE the UoW opens.
    for (const typeId of added) {
      const staffType = await this.staffTypeRepository.findById(typeId);
      if (!staffType) {
        throw new NotFoundException(`Staff type with ID ${typeId} not found`);
      }
      if (staffType.isArchived) {
        throw new BadRequestException(
          `Staff type ${staffType.name} is archived`,
        );
      }
      if (staffType.campusId !== staff.campusId) {
        throw new BadRequestException(
          `Staff type ${staffType.name} does not belong to staff's campus`,
        );
      }
      resolved.set(typeId, {
        defaultRoleId: staffType.defaultRoleId,
        name: staffType.name,
      });
    }

    // REMOVED side — best-effort name + defaultRoleId for the audit payload.
    for (const typeId of removed) {
      const staffType = await this.staffTypeRepository.findById(typeId);
      if (staffType) {
        resolved.set(typeId, {
          defaultRoleId: staffType.defaultRoleId,
          name: staffType.name,
        });
      }
    }

    // Build the target-set snapshots for `Staff.setStaffTypes`. Carry-over
    // types (in both old and new) reuse their existing snapshot to avoid an
    // unnecessary repo round-trip; added types come from `resolved`.
    const existingSnapshots = new Map(staff.staffTypes.map((t) => [t.id, t]));
    const newSnapshots: StaffTypeSnapshot[] = input.staffTypeIds.map((id) => {
      const r = resolved.get(id);
      if (r) return { id, name: r.name };
      const existing = existingSnapshots.get(id);
      if (existing) return { id: existing.id, name: existing.name };
      // Unreachable: every id in input.staffTypeIds is either in `added`
      // (resolved above) or carried over from `staff.staffTypes` (in
      // existingSnapshots). Defensive throw to satisfy the type-checker.
      throw new Error(`StaffType ${id} could not be resolved for hydration`);
    });

    return {
      added,
      removed,
      newIds: input.staffTypeIds,
      newSnapshots,
      resolved,
    };
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
   * Update with Clerk sync using Saga pattern.
   * Flow: Clerk first → DB transaction → revert Clerk on failure.
   */
  private async updateWithClerkSync(
    staff: Staff,
    input: UpdateStaffInput,
    clerkChanges: ClerkChanges,
    staffTypeDiff: StaffTypeDiff | null,
    currentUser: User,
  ): Promise<Staff> {
    const user = await this.userRepository.findById(staff.userId!);
    if (!user) {
      this.logger.warn(
        `User not found for staff ${staff.id}, falling back to DB-only update`,
      );
      return await this.updateDbOnly(staff, input, staffTypeDiff, currentUser);
    }

    const originalValues: ClerkOriginalValues = {
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      fullName: staff.fullName,
    };

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
      const updatedStaff = await this.runStaffUpdateTransaction(
        staff,
        input,
        staffTypeDiff,
        currentUser,
      );
      this.logger.log(`Staff updated successfully: ${staff.id}`);
      return updatedStaff;
    } catch (dbError) {
      // Compensate: revert Clerk to original values.
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
   * Update DB only (no Clerk sync needed).
   */
  private async updateDbOnly(
    staff: Staff,
    input: UpdateStaffInput,
    staffTypeDiff: StaffTypeDiff | null,
    currentUser: User,
  ): Promise<Staff> {
    try {
      const updatedStaff = await this.runStaffUpdateTransaction(
        staff,
        input,
        staffTypeDiff,
        currentUser,
      );
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
   * Apply the entity mutations + open the UoW. Shared by the Clerk-saga and
   * DB-only paths so the in-transaction sequence is defined exactly once:
   *
   *   1. `tx.updateStaff` (scalar columns)
   *   2. `tx.replaceStaffTypes` (full-set swap — only when a diff was supplied)
   *   3. `tx.revokeRolesByProvenance` (removed-set, when user account exists)
   *   4. `tx.assignRoles` (added-set, batched, when user account exists)
   *   5. `tx.recordAudit` (when `computeDiff` saw any field change)
   *
   * Entity mutations are applied BEFORE the UoW so `pickStaffAuditFields`
   * snapshots the after-state from the entity itself (not via in-tx reads).
   */
  private async runStaffUpdateTransaction(
    staff: Staff,
    input: UpdateStaffInput,
    staffTypeDiff: StaffTypeDiff | null,
    currentUser: User,
  ): Promise<Staff> {
    // Snapshot before/after for the EDIT_STAFF_PROFILE audit diff.
    const beforeAudit = pickStaffAuditFields(staff);
    staff.updateProfile(input);
    if (staffTypeDiff) {
      staff.setStaffTypes(staffTypeDiff.newSnapshots);
    }
    const afterAudit = pickStaffAuditFields(staff);
    const diff = computeDiff(beforeAudit, afterAudit);

    return this.unitOfWork.run(async (tx) => {
      await tx.updateStaff(staff.id, {
        fullName: staff.fullName,
        email: staff.email,
        phoneNumber: staff.phoneNumber,
        address: staff.address,
        dateOfBirth: staff.dateOfBirth,
        gender: staff.gender,
        userId: staff.userId,
        isArchived: staff.isArchived,
        updatedAt: staff.updatedAt,
      });

      if (staffTypeDiff) {
        await tx.replaceStaffTypes(staff.id, staffTypeDiff.newIds);
      }

      // Sync tracked role grants atomically with the staff write — revoke
      // the removed-types' provenance, insert the added-types' grants, and
      // surface the result for the audit payload.
      const { rolesGranted, rolesRevoked } = await this.syncTrackedGrants(
        tx,
        staff,
        staffTypeDiff,
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
  }

  /**
   * Sync tracked role grants for a staff-type set swap inside the active UoW.
   *
   * Behavioral contract (@doc/specs/staff-multi-type-refactor §Scenarios 2/3/7,
   * D-extra-3 per-provenance materialization):
   * - `staffTypeDiff` is `null` (no swap intent) → no-op.
   * - `staff.userId` is null → no-op (Scenario 7 — join rows still written
   *   upstream; `user_roles` has nothing to mutate without a user).
   * - `removed.length > 0` → single `tx.revokeRolesByProvenance(userId,
   *   removed)` round-trip. Each removed type whose pre-resolved
   *   `defaultRoleId` is non-null is named in `rolesRevoked`.
   * - `added` with non-null `defaultRoleId` → single batched
   *   `tx.assignRoles(userId, [...])` with one entry per added type. Two
   *   added types sharing the same `defaultRoleId` produce two `user_roles`
   *   rows under the 4-col NULLS NOT DISTINCT unique key (D-extra-3).
   * - The `if (inserted > 0)` count-guard from the pre-multi-type design is
   *   GONE — D5 (manual-wins) of @doc/specs/tracked-grant-revocation is
   *   retired by the 4-col unique key; every batched insert that the DB
   *   accepts is reflected in `rolesGranted`.
   *
   * Manual grants (provenance NULL) are never touched — `revokeRolesByProvenance`
   * filters by `granted_via_staff_type_id IN (...)`, which SQL NULL semantics
   * exclude (D4 of @doc/specs/tracked-grant-revocation).
   */
  private async syncTrackedGrants(
    tx: TransactionContext,
    staff: Staff,
    staffTypeDiff: StaffTypeDiff | null,
  ): Promise<TrackedGrantSync> {
    const rolesGranted: RoleProvenanceEntry[] = [];
    const rolesRevoked: RoleProvenanceEntry[] = [];

    if (!staffTypeDiff) {
      return { rolesGranted, rolesRevoked };
    }
    if (!staff.hasUserAccount()) {
      return { rolesGranted, rolesRevoked };
    }

    const userId = staff.userId!;

    if (staffTypeDiff.removed.length > 0) {
      await tx.revokeRolesByProvenance(userId, staffTypeDiff.removed);
      for (const typeId of staffTypeDiff.removed) {
        const roleId = staffTypeDiff.resolved.get(typeId)?.defaultRoleId;
        if (roleId) {
          rolesRevoked.push({ roleId, viaStaffTypeId: typeId });
        }
      }
      this.logger.log(
        `Revoked tracked grants for user ${userId} from staffTypes [${staffTypeDiff.removed.join(", ")}]`,
      );
    }

    if (staffTypeDiff.added.length > 0) {
      const assignments = staffTypeDiff.added.flatMap((typeId) => {
        const roleId =
          staffTypeDiff.resolved.get(typeId)?.defaultRoleId ?? null;
        return roleId
          ? [
              {
                roleId,
                campusId: staff.campusId,
                grantedViaStaffTypeId: typeId,
              },
            ]
          : [];
      });

      if (assignments.length > 0) {
        await tx.assignRoles(userId, assignments);
        for (const a of assignments) {
          rolesGranted.push({
            roleId: a.roleId,
            viaStaffTypeId: a.grantedViaStaffTypeId,
          });
        }
        this.logger.log(
          `Assigned ${assignments.length} default role grant(s) to user ${userId} in campus ${staff.campusId}`,
        );
      }
    }

    return { rolesGranted, rolesRevoked };
  }

  /**
   * Compensation: revert Clerk changes to original values.
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

/**
 * Audit-payload projection. `staffTypeIds` is sorted UUID-lex ASC per
 * D-extra-1 of @doc/specs/staff-multi-type-refactor — `StaffType.order` is
 * mutable, UUID is stable, so the audit row never lies retroactively.
 * `computeDiff` compares arrays by stringified equality; pre-sorting
 * guarantees no false diff when the same set is submitted in a different
 * order (Scenario 3).
 */
function pickStaffAuditFields(s: Staff) {
  return {
    fullName: s.fullName,
    email: s.email,
    phoneNumber: s.phoneNumber,
    staffTypeIds: s.staffTypes.map((t) => t.id).sort(),
    address: s.address,
    dateOfBirth: s.dateOfBirth,
    gender: s.gender,
  };
}
