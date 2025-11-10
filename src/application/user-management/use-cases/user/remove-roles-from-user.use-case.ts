import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../ports/user.repository';
import { RoleRepository } from '../../ports/role.repository';
import { UserNotFoundException } from '../../../../domain/user-management/exceptions/user-not-found.exception';
import { RoleNotFoundException } from '../../../../domain/user-management/exceptions/role-not-found.exception';

@Injectable()
export class RemoveRolesFromUserUseCase {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(userId: number, roleIds: number[]): Promise<void> {
    try {
      // 1. Validate user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new UserNotFoundException(userId);
      }

      // 2. Validate all roles exist
      for (const roleId of roleIds) {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
          throw new RoleNotFoundException(roleId);
        }
      }

      // 3. Remove roles
      await this.userRepository.removeRoles(userId, roleIds);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof RoleNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
