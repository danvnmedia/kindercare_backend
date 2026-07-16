import { SetMetadata } from "@nestjs/common";

export const REQUIRED_ALL_PERMISSIONS_KEY = "requiredAllPermissions";

/**
 * Declares a conjunctive permission policy for a route.
 *
 * Unlike @Permissions, every listed permission is required. Pair this
 * metadata with AllPermissionsGuard so existing OR-based routes are unchanged.
 */
export const RequireAllPermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_ALL_PERMISSIONS_KEY, permissions);
