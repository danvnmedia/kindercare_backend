import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { RoleRepository } from "@/application/user-management/ports/role.repository";

export interface RemovePermissionsInput {
  roleId: string;
  permissionIds: string[];
}

@Injectable()
export class RemovePermissionsFromRoleUseCase {
  private readonly logger = new Logger(RemovePermissionsFromRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(input: RemovePermissionsInput): Promise<void> {
    const { roleId, permissionIds } = input;

    this.logger.log(
      `Removing ${permissionIds.length} permissions from role ${roleId}`,
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

    // Remove permissions
    await this.roleRepository.removePermissions(roleId, permissionIds);

    this.logger.log(
      `Successfully removed ${permissionIds.length} permissions from role ${roleId}`,
    );
  }
}
