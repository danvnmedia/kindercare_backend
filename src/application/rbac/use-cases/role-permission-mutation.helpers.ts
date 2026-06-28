import { BadRequestException, NotFoundException } from "@nestjs/common";

import { PermissionRepository } from "../ports/permission.repository";
import { RoleRepository } from "@/application/user-management/ports/role.repository";
import { Role } from "@/domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";

export interface PermissionMutationContext {
  roleId: string;
  roleName: string;
  campusId: string;
  actorName: string | null;
  targetName: string;
  addedPermissionIds?: string[];
  removedPermissionIds?: string[];
  [key: string]: unknown;
}

export function normalizePermissionIds(permissionIds: string[]): string[] {
  return [...new Set(permissionIds.map((id) => id.trim()))].filter(
    (id) => id.length > 0,
  );
}

export async function loadMutableCampusRole(
  roleRepository: RoleRepository,
  roleId: string,
  campusId: string,
): Promise<Role> {
  const role = await roleRepository.findById(roleId);
  if (!role) {
    throw new NotFoundException(`Role with ID ${roleId} not found`);
  }

  if (role.isSystemDefault) {
    throw new BadRequestException(
      "Cannot modify permissions of system default roles",
    );
  }
  if (role.isSystemRole) {
    throw new BadRequestException(
      "Cannot modify permissions of system roles via API",
    );
  }
  if (role.campusId === null) {
    throw new BadRequestException(
      "Cannot modify permissions of global roles via this endpoint",
    );
  }
  if (role.campusId !== campusId) {
    throw new BadRequestException(
      `Role belongs to campus ${role.campusId}, not ${campusId}`,
    );
  }

  return role;
}

export async function validatePermissionIds(
  permissionRepository: PermissionRepository,
  permissionIds: string[],
  options: { allowEmpty?: boolean } = {},
): Promise<void> {
  if (permissionIds.length === 0) {
    if (options.allowEmpty === true) {
      return;
    }
    throw new BadRequestException("At least one permission ID is required");
  }

  const permissions = await permissionRepository.findByIds(permissionIds);
  if (permissions.length !== permissionIds.length) {
    const foundIds = new Set(permissions.map((permission) => permission.id));
    const invalidIds = permissionIds.filter((id) => !foundIds.has(id));
    throw new BadRequestException(
      `Invalid permission IDs: ${invalidIds.join(", ")}`,
    );
  }
}

export function getRolePermissionIds(role: Role): string[] {
  return role.permissions.map((permission) => permission.id).sort();
}

export function buildPermissionMutationContext(
  role: Role,
  campusId: string,
  actor: User,
  changes: {
    addedPermissionIds?: string[];
    removedPermissionIds?: string[];
  },
): PermissionMutationContext {
  return {
    roleId: role.id,
    roleName: role.name,
    campusId,
    actorName: actor.profile?.fullName ?? null,
    targetName: role.name,
    ...(changes.addedPermissionIds?.length
      ? { addedPermissionIds: changes.addedPermissionIds }
      : {}),
    ...(changes.removedPermissionIds?.length
      ? { removedPermissionIds: changes.removedPermissionIds }
      : {}),
  };
}
