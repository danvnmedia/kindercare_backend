import { User } from "@/domain/user-management/user.entity";
import { Role } from "@/domain/user-management/role.entity";

export interface RoleAuditSnapshot {
  name: string;
  description: string | null;
  campusId: string | null;
  isSystemDefault: boolean;
  isSystemRole: boolean;
  permissionIds: string[];
  [key: string]: unknown;
}

export interface RoleAuditContext {
  roleId: string;
  roleName: string;
  campusId: string;
  actorName: string | null;
  targetName: string;
  [key: string]: unknown;
}

export function pickRoleAuditFields(role: Role): RoleAuditSnapshot {
  return {
    name: role.name,
    description: role.description,
    campusId: role.campusId,
    isSystemDefault: role.isSystemDefault,
    isSystemRole: role.isSystemRole,
    permissionIds: role.permissions.map((permission) => permission.id).sort(),
  };
}

export function buildRoleAuditContext(
  role: Pick<Role, "id" | "name">,
  campusId: string,
  actor: User,
): RoleAuditContext {
  return {
    roleId: role.id,
    roleName: role.name,
    campusId,
    actorName: actor.profile?.fullName ?? null,
    targetName: role.name,
  };
}
