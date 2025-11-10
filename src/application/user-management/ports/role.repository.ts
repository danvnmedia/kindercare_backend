/**
 * Role Repository Port (Interface)
 * Defines the contract for role data access
 * Implementation will be provided by infrastructure layer
 */

import { Role } from '../../../domain/user-management/role.entity';

export interface FindAllRolesParams {
  page?: number;
  limit?: number;
  search?: string;
  ids?: number[];
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedRoles {
  data: Role[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RoleRepository {
  /**
   * Find role by ID
   */
  findById(id: number): Promise<Role | null>;

  /**
   * Find role by name
   */
  findByName(name: string): Promise<Role | null>;

  /**
   * Find all roles with filtering, sorting, pagination
   */
  findAll(params: FindAllRolesParams): Promise<PaginatedRoles>;

  /**
   * Save a new role
   */
  save(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<Role>;

  /**
   * Update existing role
   */
  update(id: number, data: Partial<Role>): Promise<Role>;

  /**
   * Delete role
   */
  delete(id: number): Promise<void>;

  /**
   * Assign users to role
   */
  assignUsers(roleId: number, userIds: number[]): Promise<void>;

  /**
   * Remove users from role
   */
  removeUsers(roleId: number, userIds: number[]): Promise<void>;

  /**
   * Get role users (paginated)
   */
  getRoleUsers(roleId: number, page: number, limit: number): Promise<any>;
}
