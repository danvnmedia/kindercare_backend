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

export interface AssignPermissionsInput {
  roleId: string;
  permissionIds: string[];
  campusId: string;
}

@Injectable()
export class AssignPermissionsToRoleUseCase {
  private readonly logger = new Logger(AssignPermissionsToRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("PERMISSION_REPOSITORY")
    private readonly permissionRepository: PermissionRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: AssignPermissionsInput,
    currentUser: User,
  ): Promise<void> {
    const { roleId, campusId } = input;
    const permissionIds = normalizePermissionIds(input.permissionIds);

    this.logger.log(
      `Assigning ${permissionIds.length} permissions to role ${roleId}`,
    );

    const role = await loadMutableCampusRole(
      this.roleRepository,
      roleId,
      campusId,
    );

    await validatePermissionIds(this.permissionRepository, permissionIds);

    const beforePermissionIds = getRolePermissionIds(role);
    const beforeSet = new Set(beforePermissionIds);
    const addedPermissionIds = permissionIds
      .filter((permissionId) => !beforeSet.has(permissionId))
      .sort();

    if (addedPermissionIds.length === 0) {
      this.logger.log(
        `No new permissions to assign to role ${roleId}`,
      );
      return;
    }

    const afterPermissionIds = [
      ...beforePermissionIds,
      ...addedPermissionIds,
    ].sort();

    await this.unitOfWork.run(async (tx) => {
      const inserted = await tx.addRolePermissions(
        roleId,
        addedPermissionIds,
      );

      if (inserted > 0) {
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
            { addedPermissionIds },
          ),
          beforeValue: { permissionIds: beforePermissionIds },
          afterValue: { permissionIds: afterPermissionIds },
        });
      }
    });

    this.logger.log(
      `Successfully assigned ${addedPermissionIds.length} permissions to role ${roleId}`,
    );
  }
}
