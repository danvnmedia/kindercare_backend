import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { RoleRepository } from '../../ports/role.repository';
import { UserRepository } from '../../ports/user.repository';
import { RoleNotFoundException } from '../../../../domain/user-management/exceptions/role-not-found.exception';
import { UserNotFoundException } from '../../../../domain/user-management/exceptions/user-not-found.exception';

@Injectable()
export class RemoveUsersFromRoleUseCase {
  constructor(
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
  ) {}

  async execute(roleId: string, userIds: string[]): Promise<void> {
    try {
      // 1. Validate role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        throw new RoleNotFoundException(roleId);
      }

      // 2. Validate all users exist
      for (const userId of userIds) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
          throw new UserNotFoundException(userId);
        }
      }

      // 3. Remove users
      await this.roleRepository.removeUsers(roleId, userIds);
    } catch (error) {
      if (error instanceof RoleNotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
