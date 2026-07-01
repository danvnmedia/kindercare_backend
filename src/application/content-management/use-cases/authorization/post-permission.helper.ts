import { RoleEntity } from "@/domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";

const POST_PERMISSION_MANAGE = "post.manage";

export function userHasPostPermission(
  user: User,
  campusId: string,
  permissionId: string,
): boolean {
  if (user.hasSystemRole()) {
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
