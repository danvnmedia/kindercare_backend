import {
  User,
  RoleAssignmentInput,
} from "../../../domain/user-management/user.entity";
import { Role } from "../../../domain/user-management/role.entity";
import {
  PaginatedResult,
  QueryOptions,
} from "@/core/modules/standard-response/dto/query.dto";

// Re-export RoleAssignmentInput for consumers
export { RoleAssignmentInput };

export interface FindAllUsersParams extends QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  ids?: string[];
  isActive?: boolean;
  roleIds?: string[];
  sortBy?: string;
  order?: "asc" | "desc";
}

export type PaginatedUsers = PaginatedResult<User>;

export abstract class UserRepository {
  /**
   * Find user by ID
   */
  abstract findById(id: string): Promise<User | null>;

  /**
   * Find user by email
   */
  abstract findByEmail(email: string): Promise<User | null>;

  /**
   * Find all users whose linked Staff or Guardian profiles match an email.
   */
  abstract findManyByEmail(email: string): Promise<User[]>;

  /**
   * Find all users whose linked Staff or Guardian profiles match a phone number.
   */
  abstract findManyByPhoneNumber(phoneNumber: string): Promise<User[]>;

  /**
   * Find user by Clerk UID
   */
  abstract findByClerkUid(clerkUid: string): Promise<User | null>;

  /**
   * Find all users with filtering, sorting, pagination
   */
  abstract findAll(params: FindAllUsersParams): Promise<PaginatedUsers>;

  /**
   * Save a new user
   */
  abstract save(user: User): Promise<User>;

  /**
   * Update existing user
   */
  abstract update(user: User): Promise<User>;

  /**
   * Delete user
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Assign roles to user with campus context
   *
   * @param userId - The user to assign roles to
   * @param roleAssignments - Array of role assignments, each with roleId and optional campusId
   *   - campusId = undefined/null: Global assignment (role applies everywhere)
   *   - campusId = string: Campus-specific assignment (role only applies in that campus)
   */
  abstract assignRoles(
    userId: string,
    roleAssignments: RoleAssignmentInput[],
  ): Promise<void>;

  /**
   * Remove roles from user with campus context
   *
   * @param userId - The user to remove roles from
   * @param roleAssignments - Array of role assignments to remove
   *   - Must match both roleId AND campusId to remove
   */
  abstract removeRoles(
    userId: string,
    roleAssignments: RoleAssignmentInput[],
  ): Promise<void>;

  /**
   * Get user roles (paginated)
   */
  abstract getUserRoles(
    userId: string,
    page: number,
    limit: number,
  ): Promise<any>;

  /**
   * Get user roles for a specific campus
   * Returns roles assigned globally (campusId = null) + roles assigned to the specific campus
   *
   * @param userId - The user ID
   * @param campusId - The campus to get roles for (null returns only global roles)
   */
  abstract getUserRolesForCampus(
    userId: string,
    campusId: string | null,
  ): Promise<Role[]>;
}
