import { Inject, Injectable, Logger } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { RoleRepository } from "@/application/user-management/ports/role.repository";
import { User } from "@/domain/user-management/user.entity";

import { PermissionRepository } from "../ports/permission.repository";
import {
  buildPermissionMutationContext,
  getRolePermissionIds,
  loadMutableCampusRole,
  normalizePermissionIds,
  validatePermissionIds,
} from "./role-permission-mutation.helpers";

export interface ReplaceRolePermissionsInput {
  roleId: string;
  permissionIds: string[];
  campusId: string;
}

@Injectable()
export class ReplaceRolePermissionsUseCase {
  private readonly logger = new Logger(ReplaceRolePermissionsUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("PERMISSION_REPOSITORY")
    private readonly permissionRepository: PermissionRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: ReplaceRolePermissionsInput,
    currentUser: User,
  ): Promise<void> {
    const { roleId, campusId } = input;
    const finalPermissionIds = normalizePermissionIds(
      input.permissionIds,
    ).sort();

    this.logger.log(
      `Replacing permissions for role ${roleId} with ${finalPermissionIds.length} permission(s)`,
    );

    const role = await loadMutableCampusRole(
      this.roleRepository,
      roleId,
      campusId,
    );

    await validatePermissionIds(this.permissionRepository, finalPermissionIds, {
      allowEmpty: true,
    });

    const beforePermissionIds = getRolePermissionIds(role);
    if (sameSet(beforePermissionIds, finalPermissionIds)) {
      this.logger.log(`Role ${roleId} already has the requested permissions`);
      return;
    }

    const beforeSet = new Set(beforePermissionIds);
    const finalSet = new Set(finalPermissionIds);
    const addedPermissionIds = finalPermissionIds.filter(
      (permissionId) => !beforeSet.has(permissionId),
    );
    const removedPermissionIds = beforePermissionIds.filter(
      (permissionId) => !finalSet.has(permissionId),
    );

    await this.unitOfWork.run(async (tx) => {
      await tx.replaceRolePermissions(roleId, finalPermissionIds);
      await tx.recordAudit({
        actorId: currentUser.id,
        action: "UPDATE_ROLE",
        targetType: "role",
        targetId: roleId,
        campusId,
        context: buildPermissionMutationContext(role, campusId, currentUser, {
          addedPermissionIds,
          removedPermissionIds,
        }),
        beforeValue: { permissionIds: beforePermissionIds },
        afterValue: { permissionIds: finalPermissionIds },
      });
    });

    this.logger.log(`Replaced permissions for role ${roleId}`);
  }
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
