/**
 * Permission Domain Entity
 * Framework-agnostic pure TypeScript entity
 * NO NestJS decorators allowed in this layer
 *
 * Permission ID format: {module}.{action}
 * Examples: 'student.create', 'class.read', 'post.delete'
 */

export interface Permission {
  id: string; // Format: module.action (e.g., 'student.create')
  module: string; // e.g., 'student', 'class', 'post'
  description: string | null;
  createdAt: Date;
}

/**
 * Permission creation data (without generated fields)
 */
export interface CreatePermissionData {
  id: string;
  module: string;
  description?: string | null;
}

/**
 * Permission business rules and validation
 */
export class PermissionEntity {
  /**
   * Valid permission modules
   */
  static readonly VALID_MODULES = [
    "campus",
    "student",
    "guardian",
    "staff",
    "class",
    "grade_level",
    "subject",
    "school_year",
    "post",
    "file",
    "role",
    "user",
    "attendance",
    "staff_type",
    "report",
    "setting",
  ] as const;

  /**
   * Valid permission actions
   */
  static readonly VALID_ACTIONS = [
    "create",
    "read",
    "update",
    "delete",
    "list",
    "manage",
    "assign",
    "export",
    "import",
  ] as const;

  /**
   * Validate permission ID format
   * Format: {module}.{action} (e.g., 'student.create')
   */
  static validateId(id: string): void {
    if (!id || typeof id !== "string") {
      throw new Error("Permission ID is required");
    }

    const parts = id.split(".");
    if (parts.length !== 2) {
      throw new Error(
        "Permission ID must be in format: module.action (e.g., 'student.create')",
      );
    }

    const [module, action] = parts;

    if (!module || module.trim().length === 0) {
      throw new Error("Permission module is required");
    }

    if (!action || action.trim().length === 0) {
      throw new Error("Permission action is required");
    }
  }

  /**
   * Validate permission module
   */
  static validateModule(module: string): void {
    if (!module || typeof module !== "string") {
      throw new Error("Permission module is required");
    }

    if (module.trim().length === 0) {
      throw new Error("Permission module cannot be empty");
    }
  }

  /**
   * Parse permission ID into module and action
   */
  static parseId(id: string): { module: string; action: string } {
    PermissionEntity.validateId(id);
    const [module, action] = id.split(".");
    return { module, action };
  }

  /**
   * Build permission ID from module and action
   */
  static buildId(module: string, action: string): string {
    return `${module}.${action}`;
  }

  /**
   * Create a new permission
   */
  static create(data: CreatePermissionData): Permission {
    PermissionEntity.validateId(data.id);
    PermissionEntity.validateModule(data.module);

    // Verify ID matches module
    const { module: parsedModule } = PermissionEntity.parseId(data.id);
    if (parsedModule !== data.module) {
      throw new Error(
        `Permission ID module '${parsedModule}' does not match provided module '${data.module}'`,
      );
    }

    return {
      id: data.id,
      module: data.module,
      description: data.description ?? null,
      createdAt: new Date(),
    };
  }

  /**
   * Check if permission ID is valid format
   */
  static isValidId(id: string): boolean {
    try {
      PermissionEntity.validateId(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all standard permissions for a module
   */
  static getStandardPermissionsForModule(module: string): string[] {
    return ["create", "read", "update", "delete", "list"].map((action) =>
      PermissionEntity.buildId(module, action),
    );
  }
}
