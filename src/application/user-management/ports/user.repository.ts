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

export interface UserRepository {
  /**
   * Find user by ID
   */
  findById(id: string): Promise<User | null>;

  /**
   * Find user by email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find user by Clerk UID
   */
  findByClerkUid(clerkUid: string): Promise<User | null>;

  /**
   * Find all users with filtering, sorting, pagination
   */
  findAll(params: FindAllUsersParams): Promise<PaginatedUsers>;

  /**
   * Save a new user
   */
  save(user: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;

  /**
   * Update existing user
   */
  update(id: string, data: Partial<User>): Promise<User>;

  /**
   * Delete user
   */
  delete(id: string): Promise<void>;

  /**
   * Assign roles to user
   */
  assignRoles(userId: string, roleIds: string[]): Promise<void>;

  /**
   * Remove roles from user
   */
  removeRoles(userId: string, roleIds: string[]): Promise<void>;

  /**
   * Get user roles (paginated)
   */
  getUserRoles(userId: string, page: number, limit: number): Promise<any>;
}
