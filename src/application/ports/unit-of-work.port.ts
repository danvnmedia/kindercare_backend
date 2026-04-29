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
