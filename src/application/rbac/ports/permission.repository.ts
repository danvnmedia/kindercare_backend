/**
 * Permission Repository Port (Interface)
 * Defines the contract for permission data access
 * Implementation will be provided by infrastructure layer
 */

import { Permission, CreatePermissionData } from "@/domain/rbac";

export abstract class PermissionRepository {
  /**
   * Find permission by ID (e.g., 'student.create')
   */
  abstract findById(id: string): Promise<Permission | null>;

  /**
   * Find all permissions
   */
  abstract findAll(): Promise<Permission[]>;

  /**
   * Find permissions by module (e.g., 'student', 'class')
   */
  abstract findByModule(module: string): Promise<Permission[]>;

  /**
   * Find permissions by IDs
   */
  abstract findByIds(ids: string[]): Promise<Permission[]>;

  /**
   * Save a new permission
   */
  abstract save(data: CreatePermissionData): Promise<Permission>;

  /**
   * Save multiple permissions (bulk insert)
   */
  abstract saveMany(data: CreatePermissionData[]): Promise<Permission[]>;

  /**
   * Check if permission exists by ID
   */
  abstract exists(id: string): Promise<boolean>;

  /**
   * Delete permission by ID
   */
  abstract delete(id: string): Promise<void>;
}
