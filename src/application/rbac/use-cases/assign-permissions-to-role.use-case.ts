import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PermissionRepository } from "../ports/permission.repository";
import { RoleRepository } from "@/application/user-management/ports/role.repository";

export interface AssignPermissionsInput {
  roleId: string;
  permissionIds: string[];
}

@Injectable()
export class AssignPermissionsToRoleUseCase {
  private readonly logger = new Logger(AssignPermissionsToRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("PERMISSION_REPOSITORY")
    private readonly permissionRepository: PermissionRepository,
  ) {}

  async execute(input: AssignPermissionsInput): Promise<void> {
    const { roleId, permissionIds } = input;

    this.logger.log(
      `Assigning ${permissionIds.length} permissions to role ${roleId}`,
    );

    // Check if role exists
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundException(`Role with ID ${roleId} not found`);
    }

    // Check if role is system default (cannot modify permissions)
    if (role.isSystemDefault) {
      throw new BadRequestException(
        "Cannot modify permissions of system default roles",
      );
    }

    // Validate all permission IDs exist
    const permissions =
      await this.permissionRepository.findByIds(permissionIds);
    if (permissions.length !== permissionIds.length) {
      const foundIds = new Set(permissions.map((p) => p.id));
      const invalidIds = permissionIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Invalid permission IDs: ${invalidIds.join(", ")}`,
      );
    }

    // Assign permissions
    await this.roleRepository.assignPermissions(roleId, permissionIds);

    this.logger.log(
      `Successfully assigned ${permissionIds.length} permissions to role ${roleId}`,
    );
  }
}
