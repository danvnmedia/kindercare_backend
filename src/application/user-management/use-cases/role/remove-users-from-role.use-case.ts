import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { RoleRepository } from "../../ports/role.repository";
import { UserRepository } from "../../ports/user.repository";
import { RoleNotFoundException } from "../../../../domain/user-management/exceptions/role-not-found.exception";
import { UserNotFoundException } from "../../../../domain/user-management/exceptions/user-not-found.exception";

@Injectable()
export class RemoveUsersFromRoleUseCase {
  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async execute(roleId: string, userIds: string[]): Promise<void> {
    try {
      // 1. Validate role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        throw new RoleNotFoundException(roleId);
      }

      // 2. Validate all users exist (parallelized to reduce latency)
      const uniqueUserIds = [...new Set(userIds)];
      const users = await Promise.all(
        uniqueUserIds.map((userId) => this.userRepository.findById(userId)),
      );
      const missingUserIndex = users.findIndex((user) => !user);
      if (missingUserIndex >= 0) {
        throw new UserNotFoundException(uniqueUserIds[missingUserIndex]);
      }

      // 3. Remove users
      await this.roleRepository.removeUsers(roleId, uniqueUserIds);
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
