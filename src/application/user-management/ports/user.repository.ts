/**
 * User Repository Port (Interface)
 * Defines the contract for user data access
 * Implementation will be provided by infrastructure layer
 */

import { User } from '../../../domain/user-management/user.entity';

export interface FindAllUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  ids?: number[];
  isActive?: boolean;
  roleIds?: number[];
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserRepository {
  /**
   * Find user by ID
   */
  findById(id: number): Promise<User | null>;

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
  save(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;

  /**
   * Update existing user
   */
  update(id: number, data: Partial<User>): Promise<User>;

  /**
   * Delete user
   */
  delete(id: number): Promise<void>;

  /**
   * Assign roles to user
   */
  assignRoles(userId: number, roleIds: number[]): Promise<void>;

  /**
   * Remove roles from user
   */
  removeRoles(userId: number, roleIds: number[]): Promise<void>;

  /**
   * Get user roles (paginated)
   */
  getUserRoles(userId: number, page: number, limit: number): Promise<any>;
}
