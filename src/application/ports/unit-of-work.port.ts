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
   * Assign roles to a user with campus context
   *
   * @param userId - The user to assign roles to
   * @param roleAssignments - Array of role assignments with optional campusId
   *   - campusId = undefined/null: Global assignment (role applies everywhere)
   *   - campusId = string: Campus-specific assignment
   */
  assignRoles(
    userId: string,
    roleAssignments: RoleAssignmentInput[],
  ): Promise<void>;

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
   * Execute a raw create operation for Staff entity
   */
  createStaff(data: {
    id: string;
    campusId: string;
    staffCode: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    staffTypeId: string | null;
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
   * Execute a raw update operation for Staff entity
   */
  updateStaff(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      staffTypeId?: string | null;
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
