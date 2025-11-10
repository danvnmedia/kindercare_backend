import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { RoleRepository } from '../../ports/role.repository';
import { RoleNotFoundException } from '../../../../domain/user-management/exceptions/role-not-found.exception';

@Injectable()
export class DeleteRoleUseCase {
  constructor(
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: number): Promise<void> {
    try {
      // 1. Find existing role
      const role = await this.roleRepository.findById(id);
      if (!role) {
        throw new RoleNotFoundException(id);
      }

      // 2. Delete role
      await this.roleRepository.delete(id);
    } catch (error) {
      if (error instanceof RoleNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
