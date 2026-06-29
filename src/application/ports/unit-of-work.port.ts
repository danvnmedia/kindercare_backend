import { AuditEventInput } from "@/application/audit";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import {
  CampusSetting,
  Post,
  PostApprovalRequest,
  PostCategory,
  PostHistoryStatus,
} from "@/domain/content-management";
import { MealMenu, MealMenuConfig } from "@/domain/meal-menu";
import {
  CreatePostOptions,
  UpdatePostOptions,
} from "../content-management/ports/post.repository";
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
   */
  revokeRolesByProvenance(
    userId: string,
    grantedViaStaffTypeIds: string[],
  ): Promise<number>;

  /**
   * Revoke role rows that match exact `(userId, roleId, campusId)` tuples,
   * regardless of provenance.
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
    userId: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ id: string }>;

  /**
   * Execute a raw update operation for Staff entity.
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
      userId?: string | null;
      isArchived?: boolean;
      updatedAt?: Date;
    },
  ): Promise<{ id: string }>;

  /**
   * Replace the full `staff_staff_type` set for a staff inside the active tx.
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
   */
  assignGuardians(
    studentId: string,
    guardianRelations: Array<{ guardianId: string; relationshipId: string }>,
  ): Promise<void>;

  /**
   * Remove guardians from a student within the transaction.
   */
  removeGuardians(studentId: string, guardianIds: string[]): Promise<void>;

  /**
   * Create a class-staff assignment within the transaction.
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
   */
  deleteClassStaff(classId: string, staffId: string): Promise<void>;

  /**
   * Update a class-staff assignment's role within the transaction.
   */
  updateClassStaff(
    classId: string,
    staffId: string,
    data: { role: ClassStaffRole; updatedAt: Date },
  ): Promise<{ classId: string; staffId: string }>;

  /**
   * Create a meal menu and its entry rows within the current transaction.
   */
  createMealMenu(mealMenu: MealMenu): Promise<MealMenu>;

  /**
   * Update a meal menu and replace its entry rows within the current transaction.
   */
  updateMealMenu(mealMenu: MealMenu): Promise<MealMenu>;

  /**
   * Soft-archive a meal menu within the current transaction.
   */
  archiveMealMenu(mealMenu: MealMenu): Promise<MealMenu>;

  /**
   * Restore a meal menu within the current transaction.
   */
  restoreMealMenu(mealMenu: MealMenu): Promise<MealMenu>;

  /**
   * Upsert meal-menu config defaults within the current transaction.
   */
  upsertMealMenuConfig(config: MealMenuConfig): Promise<MealMenuConfig>;

  createPost(post: Post, options?: CreatePostOptions): Promise<Post>;

  updatePost(
    id: string,
    post: Post,
    options?: UpdatePostOptions,
  ): Promise<Post>;

  deletePost(id: string): Promise<void>;

  createPostCategory(category: PostCategory): Promise<PostCategory>;

  updatePostCategory(category: PostCategory): Promise<PostCategory>;

  deletePostCategory(id: string): Promise<void>;

  reorderPostCategories(
    campusId: string,
    ids: string[],
  ): Promise<PostCategory[]>;

  upsertCampusSetting(setting: CampusSetting): Promise<CampusSetting>;

  createPostHistoryStatus(
    status: PostHistoryStatus,
  ): Promise<PostHistoryStatus>;

  createPostApprovalRequest(
    request: PostApprovalRequest,
  ): Promise<PostApprovalRequest>;

  updatePostApprovalRequest(
    request: PostApprovalRequest,
  ): Promise<PostApprovalRequest>;

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
