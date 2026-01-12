import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { RoleRepository } from "../../ports/role.repository";
import { RoleNotFoundException } from "../../../../domain/user-management/exceptions/role-not-found.exception";

@Injectable()
export class DeleteRoleUseCase {
  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string): Promise<void> {
    try {
      // 1. Find existing role
      const role = await this.roleRepository.findById(id);
      if (!role) {
        throw new RoleNotFoundException(id);
      }

      // 2. Check if role is system default or system role (cannot be deleted)
      if (role.isSystemDefault) {
        throw new BadRequestException("System default roles cannot be deleted");
      }
      if (role.isSystemRole) {
        throw new BadRequestException("System roles cannot be deleted via API");
      }

      // 3. Delete role
      await this.roleRepository.delete(id);
    } catch (error) {
      if (error instanceof RoleNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
