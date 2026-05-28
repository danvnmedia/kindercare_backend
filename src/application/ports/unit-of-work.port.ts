import { AuditEventInput } from "@/application/audit";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { RoleAssignmentInput } from "../user-management/ports/user.repository";

/**
 * Unit of Work Port
 *
 * Provides transaction management abstraction for use cases.
 * Follows Clean Architecture - application layer defines the contract,
 * infrastructure layer provides the implementation.
 *
 * Usage in Use Cases:
 * ```typescript
 * async execute(command: Command): Promise<Result> {
 *   return this.unitOfWork.run(async (tx) => {
 *     // All operations here are within a single transaction
 *     const user = await tx.userRepository.save(userEntity);
 *     const guardian = await tx.guardianRepository.save(guardianEntity);
 *     return guardian;
 *   });
 * }
 * ```
 */

/**
 * Transaction context providing access to transactional repositories
 * Each repository operation within this context participates in the same transaction
 */
export interface TransactionContext {
  /**
   * Execute a raw create operation for User entity
   */
  createUser(data: {
    clerkUid: string;
    isActive: boolean;
  }): Promise<{ id: string; clerkUid: string }>;

  /**
   * Execute a raw update operation for User entity
   */
  updateUser(
    id: string,
    data: {
      isActive?: boolean;
    },
  ): Promise<{ id: string }>;

  /**
   * Assign roles to a user with campus + provenance context.
   *
   * @param userId - The user to assign roles to
   * @param roleAssignments - Array of role assignments
   *   - `campusId = undefined/null`: global assignment (role applies everywhere)
   *   - `campusId = string`: campus-specific assignment
   *   - `grantedViaStaffTypeId = undefined/null`: manual grant (never auto-revoked)
   *   - `grantedViaStaffTypeId = string`: tracked grant — eligible for revoke
   *     when the staff's staff-type changes
   * @returns the number of rows actually inserted. When the existing
   *   `(userId, roleId, campusId)` unique constraint already holds a row, the
   *   insert is silently skipped (D5 manual-wins) and that row is NOT counted.
   *   Callers use the count to decide whether to emit a `rolesGranted` audit
   *   entry — see @doc/specs/tracked-grant-revocation#d5-conflict-mechanics-manual-wins.
   */
  assignRoles(
    userId: string,
    roleAssignments: Array<
      RoleAssignmentInput & { grantedViaStaffTypeId?: string | null }
    >,
  ): Promise<number>;

  /**
   * Revoke every role row whose provenance matches ANY staff-type in the
   * supplied set.
   *
   * Used by `UpdateStaffUseCase` when the staff's `staffTypes` collection
   * changes — the use case computes the `removed` set via set-diff and passes
   * it here in one SQL round-trip via `deleteMany` with `IN (...)` (D-extra-2
   * of @doc/specs/staff-multi-type-refactor).
   *
   * Manual grants (`granted_via_staff_type_id IS NULL`) are never matched by
   * SQL semantics — a non-null string in an `IN (...)` predicate cannot equal
   * `NULL`, so the D4 "manual rows untouched" invariant of
   * @doc/specs/tracked-grant-revocation holds without explicit guards.
   *
   * Empty input is permitted (Prisma compiles `{ in: [] }` to a `false`
   * predicate and returns 0), but callers are expected to short-circuit
   * before calling — see the use-case set-diff snippet in
   * @doc/specs/staff-multi-type-refactor#technical-notes.
   *
   * @returns the number of rows deleted (0 when no tracked grant matches).
   */
  revokeRolesByProvenance(
    userId: string,
    grantedViaStaffTypeIds: string[],
  ): Promise<number>;

  /**
   * Revoke role rows that match exact `(userId, roleId, campusId)` tuples,
   * regardless of provenance.
   *
   * Used by admin direct-revoke endpoints (`DELETE /roles/:id/users`) to remove
   * either manual or tracked rows by their natural key. Distinct from
   * `revokeRolesByProvenance`, which filters by `granted_via_staff_type_id`
   * and is the staff-type-driven auto-revoke path — see Scenario 9 of
   * @doc/specs/direct-role-assignment-via-uow for the boundary contract:
   * manual revoke deletes BOTH NULL- and non-NULL-provenance rows whose
   * natural key matches, because the filter never mentions provenance.
   *
   * @returns the number of rows actually deleted; 0 when the user holds none
   *   of the specified pairs (idempotent — no throw on no-match).
   */
  revokeRoles(
    userId: string,
    removals: Array<{ roleId: string; campusId: string | null }>,
  ): Promise<number>;

  /**
   * Execute a raw create operation for Guardian entity
   */
  createGuardian(data: {
    id: string;
    campusId: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    address: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    occupation: string | null;
    workAddress: string | null;
    userId: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ id: string }>;

  /**
   * Execute a raw update operation for Guardian entity
   */
  updateGuardian(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      address?: string | null;
      dateOfBirth?: Date | null;
      gender?: string | null;
      occupation?: string | null;
      workAddress?: string | null;
      isArchived?: boolean;
      updatedAt?: Date;
    },
  ): Promise<{ id: string }>;

  /**
   * Execute a raw create operation for Staff entity.
   *
   * Scalar columns only — the staff-type set lives in `staff_staff_type`
   * and is written via `replaceStaffTypes` immediately after this call.
   * The legacy `staff_type_id` column was removed by
   * @doc/specs/staff-multi-type-refactor (D5).
   */
  createStaff(data: {
    id: string;
    campusId: string;
    staffCode: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    address: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    startDate: Date | null;
    userId: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ id: string }>;

  /**
   * Execute a raw update operation for Staff entity.
   *
   * Scalar columns only — the staff-type set lives in `staff_staff_type`
   * and is written via `replaceStaffTypes` in the same transaction. The
   * legacy `staff_type_id` column was removed by
   * @doc/specs/staff-multi-type-refactor (D5).
   */
  updateStaff(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      address?: string | null;
      dateOfBirth?: Date | null;
      gender?: string | null;
      startDate?: Date | null;
      userId?: string | null;
      isArchived?: boolean;
      updatedAt?: Date;
    },
  ): Promise<{ id: string }>;

  /**
   * Replace the full `staff_staff_type` set for a staff inside the active tx.
   *
   * Semantics: full-set replacement — `deleteMany({ where: { staffId } })`
   * clears every existing join row, then `createMany` inserts one row per
   * supplied `staffTypeId`. Idempotent for the same set: the resulting rows
   * are equivalent (the `createdAt` column is the only field that resets,
   * which audit code does not rely on).
   *
   * Called by both `CreateStaffUseCase` (initial set) and `UpdateStaffUseCase`
   * (set-diff swap — see @doc/specs/staff-multi-type-refactor §Use-case
   * set-diff). The min-1 invariant (D4) is enforced upstream by the DTO
   * (`@ArrayMinSize(1)`) and the domain entity (`setStaffTypes`); this op
   * does not re-validate so legacy NULL-orphan rows (D5) can be migrated to
   * empty sets if a future workflow ever requires it.
   *
   * Atomic with surrounding UoW writes — a failure here rolls back the
   * parent `tx.updateStaff`/`tx.createStaff` mutation by transaction
   * boundary.
   *
   * @param staffId - The staff whose join set is replaced.
   * @param staffTypeIds - The full target set. Duplicates surface as `P2002`
   *   (PK collision) by Prisma — caller responsibility to dedupe.
   */
  replaceStaffTypes(staffId: string, staffTypeIds: string[]): Promise<void>;

  /**
   * Execute a raw create operation for Student entity
   */
  createStudent(data: {
    id: string;
    campusId: string;
    studentCode: string;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
    address: string | null;
    dateOfBirth: Date | null;
    nickname: string | null;
    gender: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ id: string }>;

  /**
   * Execute a raw update operation for Student entity.
   *
   * Immutable fields (`studentCode`, `campusId`, `createdAt`) are excluded by
   * design — see `@doc/guides/code-generation-pattern#immutability`.
   */
  updateStudent(
    id: string,
    data: {
      fullName?: string;
      email?: string | null;
      phoneNumber?: string | null;
      address?: string | null;
      dateOfBirth?: Date | null;
      nickname?: string | null;
      gender?: string | null;
      isArchived?: boolean;
      updatedAt?: Date;
    },
  ): Promise<{ id: string }>;

  /**
   * Assign guardians to a student within the transaction.
   *
   * Mirrors `StudentRepository.assignGuardians`; called by the link use case
   * so the audit row + relationship insert atomically commit together (D4).
   */
  assignGuardians(
    studentId: string,
    guardianRelations: Array<{ guardianId: string; relationshipId: string }>,
  ): Promise<void>;

  /**
   * Remove guardians from a student within the transaction.
   *
   * Mirrors `StudentRepository.removeGuardians`. Used by the unlink use case;
   * callers must pre-resolve any relationship snapshot for `context` BEFORE
   * invoking this op (the row is gone by audit time).
   */
  removeGuardians(studentId: string, guardianIds: string[]): Promise<void>;

  /**
   * Create a class-staff assignment within the transaction.
   *
   * Used by `AssignStaffToClassUseCase` so the new row and its
   * `ASSIGN_STAFF_TO_CLASS` audit event commit atomically (D4 of
   * `@doc/specs/admin-audit-log`).
   */
  createClassStaff(data: {
    classId: string;
    staffId: string;
    role: ClassStaffRole;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ classId: string; staffId: string }>;

  /**
   * Delete a class-staff assignment within the transaction.
   *
   * Used by `RemoveStaffFromClassUseCase` so the row deletion and its
   * `REMOVE_STAFF_FROM_CLASS` audit event commit atomically. Callers must
   * pre-resolve the role for the audit `context` BEFORE invoking this op —
   * the row is gone by audit time.
   */
  deleteClassStaff(classId: string, staffId: string): Promise<void>;

  /**
   * Update a class-staff assignment's role within the transaction.
   *
   * Used by `ChangeClassStaffRoleUseCase` so the role update and its
   * `CHANGE_STAFF_ROLE` audit event commit atomically (D4 of
   * `@doc/specs/admin-audit-log`). Identity `(classId, staffId)` is immutable
   * — only mutable fields (`role`, `updatedAt`) are accepted.
   */
  updateClassStaff(
    classId: string,
    staffId: string,
    data: { role: ClassStaffRole; updatedAt: Date },
  ): Promise<{ classId: string; staffId: string }>;

  /**
   * Record an audit event inside the current transaction.
   *
   * Delegates to `AuditEventRecorderPort.record` with the underlying Prisma
   * transaction client supplied by the UoW — callers never touch
   * `Prisma.TransactionClient` directly. Guarantees same-tx atomicity (D4 of
   * `@doc/specs/admin-audit-log`): if this throws, the surrounding
   * `unitOfWork.run` rolls back the mutation as well.
   */
  recordAudit(input: AuditEventInput): Promise<void>;
}

/**
 * Unit of Work Port - Abstract class for transaction management
 *
 * Implementations must wrap operations in a database transaction,
 * ensuring all operations succeed or all fail together.
 */
export abstract class UnitOfWorkPort {
  /**
   * Execute a task within a transaction
   * @param task - Async function that receives transaction context
   * @returns Result of the task
   * @throws Error if any operation within the transaction fails (all operations are rolled back)
   */
  abstract run<T>(task: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
