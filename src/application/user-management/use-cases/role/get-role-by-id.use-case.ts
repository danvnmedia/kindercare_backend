import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Role } from "../../../../domain/user-management/role.entity";
import { RoleRepository } from "../../ports/role.repository";
import { RoleNotFoundException } from "../../../../domain/user-management/exceptions/role-not-found.exception";

export interface GetRoleByIdOptions {
  campusId?: string;
  includeSystemRoles?: boolean;
}

@Injectable()
export class GetRoleByIdUseCase {
  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, options: GetRoleByIdOptions = {}): Promise<Role> {
    try {
      const role = await this.roleRepository.findById(id);

      if (!role) {
        throw new RoleNotFoundException(id);
      }

      if (options.campusId) {
        const isSystemRoleVisible =
          options.includeSystemRoles === true && role.campusId === null;
        if (role.campusId !== options.campusId && !isSystemRoleVisible) {
          throw new ForbiddenException(
            `Role ${id} is not available in campus ${options.campusId}`,
          );
        }
      }

      return role;
    } catch (error) {
      if (error instanceof RoleNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
