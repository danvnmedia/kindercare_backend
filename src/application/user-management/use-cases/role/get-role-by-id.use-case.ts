import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Role } from '../../../../domain/user-management/role.entity';
import { RoleRepository } from '../../ports/role.repository';
import { RoleNotFoundException } from '../../../../domain/user-management/exceptions/role-not-found.exception';

@Injectable()
export class GetRoleByIdUseCase {
  constructor(
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: number): Promise<Role> {
    try {
      const role = await this.roleRepository.findById(id);

      if (!role) {
        throw new RoleNotFoundException(id);
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
