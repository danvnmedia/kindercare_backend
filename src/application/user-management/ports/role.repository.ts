/**
 * Role Repository Port (Interface)
 * Defines the contract for role data access
 * Implementation will be provided by infrastructure layer
 */

import { Role, CreateRoleData } from '../../../domain/user-management/role.entity';

export interface FindAllRolesParams {
  page?: number;
  limit?: number;
  search?: string;
  ids?: string[];
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
  findById(id: string): Promise<Role | null>;

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
  save(role: CreateRoleData): Promise<Role>;

  /**
   * Update existing role
   */
  update(id: string, data: Partial<Role>): Promise<Role>;

  /**
   * Delete role
   */
  delete(id: string): Promise<void>;

  /**
   * Assign users to role
   */
  assignUsers(roleId: string, userIds: string[]): Promise<void>;

  /**
   * Remove users from role
   */
  removeUsers(roleId: string, userIds: string[]): Promise<void>;

  /**
   * Get role users (paginated)
   */
  getRoleUsers(roleId: string, page: number, limit: number): Promise<any>;
}
