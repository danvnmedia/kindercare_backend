import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Role, UpdateRoleData, RoleEntity } from '../../../../domain/user-management/role.entity';
import { RoleRepository } from '../../ports/role.repository';
import { RoleNotFoundException } from '../../../../domain/user-management/exceptions/role-not-found.exception';

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: Record<string, any>;
  isActive?: boolean;
}

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, input: UpdateRoleInput): Promise<Role> {
    try {
      // 1. Find existing role
      const currentRole = await this.roleRepository.findById(id);
      if (!currentRole) {
        throw new RoleNotFoundException(id);
      }

      // 2. Validate name if provided
      if (input.name) {
        RoleEntity.validateName(input.name);
      }

      // 3. Validate permissions if provided
      if (input.permissions) {
        RoleEntity.validatePermissions(input.permissions);
      }

      // 4. Prepare update data
      const updateData: UpdateRoleData = {
        name: input.name?.trim(),
        description: input.description?.trim(),
        permissions: input.permissions,
        isActive: input.isActive,
      };

      // 5. Update role
      const updatedRole = await this.roleRepository.update(id, updateData);
      return updatedRole;
    } catch (error) {
      if (error instanceof RoleNotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (error.message.includes('cannot be empty') || error.message.includes('must be at least')) {
        throw new BadRequestException(error.message);
      }
      if (error.message.includes('must be a valid object')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
