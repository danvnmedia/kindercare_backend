import { PostTransitionAction } from "@/domain/content-management/enums";
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

export function getRequiredPostTransitionPermission(
  action: PostTransitionAction,
): "post.review" | "post.update" | null {
  switch (action) {
    case PostTransitionAction.APPROVE:
    case PostTransitionAction.REJECT:
      return "post.review";
    case PostTransitionAction.ARCHIVE:
    case PostTransitionAction.PUBLISH:
    case PostTransitionAction.REVISE:
    case PostTransitionAction.SUBMIT:
      return "post.update";
    default:
      return null;
  }
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
