/**
 * Role Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 */

import { Permission } from "../rbac";

export interface Role {
  id: string;
  name: string;
  description: string | null;
  campusId: string | null; // null for system default roles
  isSystemDefault: boolean; // true for built-in roles that cannot be modified
  permissions: Permission[]; // Array of Permission entities
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Role creation data (without generated fields)
 */
export interface CreateRoleData {
  id: string;
  name: string;
  description?: string | null;
  campusId?: string | null;
  isSystemDefault?: boolean;
  permissionIds?: string[]; // Permission IDs to assign
}

/**
 * Role update data (partial)
 */
export interface UpdateRoleData {
  name?: string;
  description?: string | null;
  campusId?: string | null;
}

/**
 * Role business rules and validation
 */
export class RoleEntity {
  /**
   * Validate role name (must be non-empty and unique)
   */
  static validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error("Role name cannot be empty");
    }
    if (name.trim().length < 2) {
      throw new Error("Role name must be at least 2 characters");
    }
  }

  /**
   * Validate campusId format (UUID or null)
   */
  static validateCampusId(campusId: string | null): void {
    if (campusId !== null) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(campusId)) {
        throw new Error("Campus ID must be a valid UUID");
      }
    }
  }

  /**
   * Check if role has specific permission
   * @param role Role entity
   * @param module Module name (e.g., 'student')
   * @param action Action name (e.g., 'create')
   */
  static hasPermission(role: Role, module: string, action: string): boolean {
    if (!role.permissions || !Array.isArray(role.permissions)) {
      return false;
    }

    const permissionId = `${module}.${action}`;
    return role.permissions.some((p) => p.id === permissionId);
  }

  /**
   * Check if role has permission by ID
   * @param role Role entity
   * @param permissionId Permission ID (e.g., 'student.create')
   */
  static hasPermissionById(role: Role, permissionId: string): boolean {
    if (!role.permissions || !Array.isArray(role.permissions)) {
      return false;
    }

    return role.permissions.some((p) => p.id === permissionId);
  }

  /**
   * Check if role is a system default role
   */
  static isSystemDefault(role: Role): boolean {
    return role.isSystemDefault;
  }

  /**
   * Check if role is campus-scoped
   */
  static isCampusScoped(role: Role): boolean {
    return role.campusId !== null;
  }

  /**
   * Get all permission IDs for a role
   */
  static getPermissionIds(role: Role): string[] {
    if (!role.permissions || !Array.isArray(role.permissions)) {
      return [];
    }
    return role.permissions.map((p) => p.id);
  }

  /**
   * Get permissions grouped by module
   */
  static getPermissionsByModule(role: Role): Record<string, Permission[]> {
    if (!role.permissions || !Array.isArray(role.permissions)) {
      return {};
    }

    return role.permissions.reduce(
      (acc, permission) => {
        if (!acc[permission.module]) {
          acc[permission.module] = [];
        }
        acc[permission.module].push(permission);
        return acc;
      },
      {} as Record<string, Permission[]>,
    );
  }
}
