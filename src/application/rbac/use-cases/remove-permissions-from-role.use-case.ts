import {
  Injectable,
  Inject,
  Logger,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { PermissionRepository } from "../ports/permission.repository";
import { RoleRepository } from "@/application/user-management/ports/role.repository";
import { User } from "@/domain/user-management/user.entity";
import {
  buildPermissionMutationContext,
  getRolePermissionIds,
  loadMutableCampusRole,
  normalizePermissionIds,
  validatePermissionIds,
} from "./role-permission-mutation.helpers";

export interface RemovePermissionsInput {
  roleId: string;
  permissionIds: string[];
  campusId: string;
}

@Injectable()
export class RemovePermissionsFromRoleUseCase {
  private readonly logger = new Logger(RemovePermissionsFromRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("PERMISSION_REPOSITORY")
    private readonly permissionRepository: PermissionRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: RemovePermissionsInput,
    currentUser: User,
  ): Promise<void> {
    const { roleId, campusId } = input;
    const permissionIds = normalizePermissionIds(input.permissionIds);

    this.logger.log(
      `Removing ${permissionIds.length} permissions from role ${roleId}`,
    );

    const role = await loadMutableCampusRole(
      this.roleRepository,
      roleId,
      campusId,
    );

    await validatePermissionIds(this.permissionRepository, permissionIds);

    const beforePermissionIds = getRolePermissionIds(role);
    const beforeSet = new Set(beforePermissionIds);
    const removedPermissionIds = permissionIds
      .filter((permissionId) => beforeSet.has(permissionId))
      .sort();

    if (removedPermissionIds.length === 0) {
      this.logger.log(
        `No assigned permissions to remove from role ${roleId}`,
      );
      return;
    }

    const removedSet = new Set(removedPermissionIds);
    const afterPermissionIds = beforePermissionIds.filter(
      (permissionId) => !removedSet.has(permissionId),
    );

    await this.unitOfWork.run(async (tx) => {
      const deleted = await tx.removeRolePermissions(
        roleId,
        removedPermissionIds,
      );

      if (deleted > 0) {
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "UPDATE_ROLE",
          targetType: "role",
          targetId: roleId,
          campusId,
          context: buildPermissionMutationContext(
            role,
            campusId,
            currentUser,
            { removedPermissionIds },
          ),
          beforeValue: { permissionIds: beforePermissionIds },
          afterValue: { permissionIds: afterPermissionIds },
        });
      }
    });

    this.logger.log(
      `Successfully removed ${removedPermissionIds.length} permissions from role ${roleId}`,
    );
  }
}
