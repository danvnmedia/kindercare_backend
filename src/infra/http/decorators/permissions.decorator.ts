import { applyDecorators, SetMetadata } from "@nestjs/common";
import { CmsPublicRead } from "./cms-route-visibility.decorator";

/**
 * Metadata key for permissions
 */
export const PERMISSIONS_KEY = "permissions";

/**
 * Decorator to require specific permissions for a route
 *
 * @example
 * @Permissions('student.create', 'student.update')
 * async createStudent() { ... }
 *
 * @example
 * // Require any of these permissions (OR logic)
 * @Permissions('student.create', 'admin.manage')
 *
 * @param permissions - Permission IDs required (e.g., 'student.create', 'class.read')
 */
export const Permissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    ...(permissions.includes("post.read") ? [CmsPublicRead()] : []),
  );
