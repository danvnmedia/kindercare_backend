import {
  Role,
  CreateRoleData,
  UpdateRoleData,
} from "../../../domain/user-management/role.entity";
import { Permission } from "@/domain/rbac";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

export type PaginatedRoles = PaginatedResult<Role>;

export const STAFF_CAMPUS_ACCESS_ROLE_NAME = "Staff Campus Access";
export const STAFF_CAMPUS_ACCESS_ROLE_DESCRIPTION =
  "Backend-managed minimal role that grants staff campus discovery when no StaffType default role is configured. It carries no permissions; feature access remains permission-gated.";

export interface RoleMemberProfile {
  type: "staff" | "guardian" | null;
  id: string | null;
  fullName: string | null;
  email: string | null;
  phoneNumber: string | null;
  dateOfBirth: Date | null;
}

export interface RoleMemberProvenance {
  source: "manual" | "staff_type";
  grantedViaStaffTypeId: string | null;
  staffTypeName: string | null;
  canOverride: boolean;
  warning: string | null;
}

export interface RoleMember {
  assignmentId: string;
  userId: string;
  clerkUid: string;
  isActive: boolean;
  campusId: string | null;
  assignedAt: Date;
  profile: RoleMemberProfile;
  provenance: RoleMemberProvenance;
}

export type PaginatedRoleMembers = PaginatedResult<RoleMember>;

export interface FindAllRolesOptions {
  campusId?: string;
  includeSystemRoles?: boolean;
  onlySystemRoles?: boolean;
}

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
   * Find or create the backend-managed minimal campus access role used as a
   * compatibility fallback when StaffType.defaultRoleId is not configured.
   */
  ensureCampusAccessRole(campusId: string): Promise<Role>;

  /**
   * Find all roles with filtering, sorting, pagination
   */
  findAll(
    params: StandardRequest,
    options?: FindAllRolesOptions,
  ): Promise<PaginatedRoles>;

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

  /**
   * Get role members with assignment provenance (paginated)
   */
  getRoleMembers(
    roleId: string,
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedRoleMembers>;
}
