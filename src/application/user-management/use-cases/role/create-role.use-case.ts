import { Injectable, Inject, ConflictException, BadRequestException } from '@nestjs/common';
import { Role, CreateRoleData, RoleEntity } from '../../../../domain/user-management/role.entity';
import { RoleRepository } from '../../ports/role.repository';

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: Record<string, any>;
  isActive?: boolean;
}

@Injectable()
export class CreateRoleUseCase {
  constructor(
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(input: CreateRoleInput): Promise<Role> {
    try {
      // 1. Validate role name
      RoleEntity.validateName(input.name);
      const normalizedName = input.name.trim();
      const roleId = normalizedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

      if (!roleId) {
        throw new BadRequestException('Role name must contain alphanumeric characters');
      }

      // 2. Check name uniqueness
      const existingRole = await this.roleRepository.findByName(input.name);
      if (existingRole) {
        throw new ConflictException(`Role with name "${input.name}" already exists`);
      }
      const existingRoleById = await this.roleRepository.findById(roleId);
      if (existingRoleById) {
        throw new ConflictException(`Role with id "${roleId}" already exists`);
      }

      // 3. Validate permissions structure
      RoleEntity.validatePermissions(input.permissions);

      // 4. Prepare role data
      const roleData: CreateRoleData = {
        id: roleId,
        name: normalizedName,
        description: input.description?.trim() || null,
        permissions: input.permissions,
        isActive: input.isActive ?? true,
      };

      // 5. Save role
      const savedRole = await this.roleRepository.save(roleData);
      return savedRole;
    } catch (error) {
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
