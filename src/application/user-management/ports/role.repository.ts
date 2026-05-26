import {
  Role,
  CreateRoleData,
  UpdateRoleData,
} from "../../../domain/user-management/role.entity";
import { Permission } from "@/domain/rbac";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

export type PaginatedRoles = PaginatedResult<Role>;

export interface RoleRepository {
  /**
   * Find role by ID (includes permissions)
   */
  findById(id: string): Promise<Role | null>;

  /**
   * Find role by name within a campus context
   * @param name Role name
   * @param campusId Campus ID (null for system defaults)
   */
  findByName(name: string, campusId: string | null): Promise<Role | null>;

  /**
   * Find all roles with filtering, sorting, pagination
   */
  findAll(params: StandardRequest): Promise<PaginatedRoles>;

  /**
   * Find all roles for a specific campus
   */
  findByCampusId(campusId: string): Promise<Role[]>;

  /**
   * Find all system default roles (campusId is null)
   */
  findSystemDefaults(): Promise<Role[]>;

  /**
   * Save a new role
   */
  save(role: CreateRoleData): Promise<Role>;

  /**
   * Update existing role
   */
  update(id: string, data: UpdateRoleData): Promise<Role>;

  /**
   * Delete role
   */
  delete(id: string): Promise<void>;

  /**
   * Check if role exists by ID
   */
  exists(id: string): Promise<boolean>;

  /**
   * Assign permissions to role
   */
  assignPermissions(roleId: string, permissionIds: string[]): Promise<void>;

  /**
   * Remove permissions from role
   */
  removePermissions(roleId: string, permissionIds: string[]): Promise<void>;

  /**
   * Get all permissions for a role
   */
  getPermissions(roleId: string): Promise<Permission[]>;

  /**
   * Get role users (paginated)
   */
  getRoleUsers(roleId: string, page: number, limit: number): Promise<any>;
}
