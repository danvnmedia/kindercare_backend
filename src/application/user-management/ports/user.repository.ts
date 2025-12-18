import { User } from "../../../domain/user-management/user.entity";
import {
  PaginatedResult,
  QueryOptions,
} from "@/core/modules/standard-response/dto/query.dto";

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
   * Assign roles to user
   */
  abstract assignRoles(userId: string, roleIds: string[]): Promise<void>;

  /**
   * Remove roles from user
   */
  abstract removeRoles(userId: string, roleIds: string[]): Promise<void>;

  /**
   * Get user roles (paginated)
   */
  abstract getUserRoles(
    userId: string,
    page: number,
    limit: number,
  ): Promise<any>;
}
