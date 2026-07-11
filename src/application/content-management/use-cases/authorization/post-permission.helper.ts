import { RoleEntity } from "@/domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";

const POST_PERMISSION_MANAGE = "post.manage";

export function userHasPostPermission(
  user: User,
  campusId: string,
  permissionId: string,
): boolean {
  const hasGlobalSystemRole = user
    .getGlobalRoles()
    .some((role) => RoleEntity.isSystemRole(role));
  if (hasGlobalSystemRole) {
    return true;
  }

  return user
    .getRolesForCampus(campusId)
    .some(
      (role) =>
        RoleEntity.hasPermissionById(role, permissionId) ||
        RoleEntity.hasPermissionById(role, POST_PERMISSION_MANAGE),
    );
}

export function userCanManagePost(
  user: User,
  campusId: string,
  authorId: string,
): boolean {
  return (
    user.id.toString() === authorId.toString() ||
    userHasPostPermission(user, campusId, POST_PERMISSION_MANAGE)
  );
}
