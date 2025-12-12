/**
 * Role Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 */

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, any>; // JSON field for permissions
  isActive: boolean;
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
  permissions: Record<string, any>;
  isActive?: boolean;
}

/**
 * Role update data (partial)
 */
export interface UpdateRoleData {
  name?: string;
  description?: string | null;
  permissions?: Record<string, any>;
  isActive?: boolean;
}

/**
 * Permission structure (recommended format)
 */
export interface Permission {
  resource: string; // e.g., 'users', 'students', 'classes'
  actions: string[]; // e.g., ['read', 'create', 'update', 'delete']
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
   * Validate permissions structure
   */
  static validatePermissions(permissions: Record<string, any>): void {
    if (!permissions || typeof permissions !== "object") {
      throw new Error("Permissions must be a valid object");
    }
  }

  /**
   * Check if role has specific permission
   * @param role Role entity
   * @param resource Resource name (e.g., 'users')
   * @param action Action name (e.g., 'create')
   */
  static hasPermission(role: Role, resource: string, action: string): boolean {
    if (!role.permissions || typeof role.permissions !== "object") {
      return false;
    }

    // Check if permissions is an array of Permission objects
    if (Array.isArray(role.permissions)) {
      const permissions = role.permissions as Permission[];
      const permission = permissions.find((p) => p.resource === resource);
      return permission ? permission.actions.includes(action) : false;
    }

    // Check if permissions is a flat object: { "users:create": true }
    const permissionKey = `${resource}:${action}`;
    return Boolean(role.permissions[permissionKey]);
  }

  /**
   * Add permission to role
   */
  static addPermission(role: Role, resource: string, action: string): Role {
    const updatedPermissions = { ...role.permissions };

    // Handle array format
    if (Array.isArray(updatedPermissions)) {
      const permissions = updatedPermissions as Permission[];
      const existingIndex = permissions.findIndex(
        (p) => p.resource === resource,
      );

      if (existingIndex >= 0) {
        if (!permissions[existingIndex].actions.includes(action)) {
          permissions[existingIndex].actions.push(action);
        }
      } else {
        permissions.push({ resource, actions: [action] });
      }

      return { ...role, permissions: permissions };
    }

    // Handle flat object format
    updatedPermissions[`${resource}:${action}`] = true;
    return { ...role, permissions: updatedPermissions };
  }

  /**
   * Remove permission from role
   */
  static removePermission(role: Role, resource: string, action: string): Role {
    const updatedPermissions = { ...role.permissions };

    // Handle array format
    if (Array.isArray(updatedPermissions)) {
      const permissions = updatedPermissions as Permission[];
      const existingIndex = permissions.findIndex(
        (p) => p.resource === resource,
      );

      if (existingIndex >= 0) {
        permissions[existingIndex].actions = permissions[
          existingIndex
        ].actions.filter((a) => a !== action);

        // Remove resource if no actions left
        if (permissions[existingIndex].actions.length === 0) {
          permissions.splice(existingIndex, 1);
        }
      }

      return { ...role, permissions: permissions };
    }

    // Handle flat object format
    delete updatedPermissions[`${resource}:${action}`];
    return { ...role, permissions: updatedPermissions };
  }

  /**
   * Check if role is active
   */
  static isActive(role: Role): boolean {
    return role.isActive;
  }

  /**
   * Activate role
   */
  static activate(role: Role): Role {
    return { ...role, isActive: true };
  }

  /**
   * Deactivate role
   */
  static deactivate(role: Role): Role {
    return { ...role, isActive: false };
  }

  /**
   * Update role permissions
   */
  static updatePermissions(role: Role, permissions: Record<string, any>): Role {
    RoleEntity.validatePermissions(permissions);
    return {
      ...role,
      permissions,
      updatedAt: new Date(),
    };
  }
}
