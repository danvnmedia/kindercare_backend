import { User } from "@/domain/user-management/user.entity";

export function getPermissionIdsForCampus(
  user: User,
  campusId: string | null,
): Set<string> {
  const permissionIds = new Set<string>();

  for (const role of user.getRolesForCampus(campusId)) {
    for (const permission of role.permissions ?? []) {
      permissionIds.add(permission.id);
    }
  }

  return permissionIds;
}

export function hasAnyPermission(
  permissionIds: ReadonlySet<string>,
  requiredPermissions: readonly string[],
): boolean {
  if (requiredPermissions.length === 0) {
    return true;
  }

  return requiredPermissions.some((permission) =>
    permissionIds.has(permission),
  );
}

export function hasAnyPermissionInCampus(
  user: User,
  campusId: string | null,
  requiredPermissions: readonly string[],
): boolean {
  return hasAnyPermission(
    getPermissionIdsForCampus(user, campusId),
    requiredPermissions,
  );
}
