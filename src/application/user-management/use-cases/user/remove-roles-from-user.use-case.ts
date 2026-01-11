import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import {
  UserRepository,
  RoleAssignmentInput,
} from "../../ports/user.repository";
import { RoleRepository } from "../../ports/role.repository";
import { UserNotFoundException } from "../../../../domain/user-management/exceptions/user-not-found.exception";
import { RoleNotFoundException } from "../../../../domain/user-management/exceptions/role-not-found.exception";

/**
 * Input for removing roles from a user
 */
export interface RemoveRolesFromUserInput {
  roleId: string;
  campusId?: string | null; // Must match the assignment's campus context
}

@Injectable()
export class RemoveRolesFromUserUseCase {
  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Remove roles from a user with campus context
   *
   * @param userId - The user to remove roles from
   * @param roleAssignments - Array of role assignments to remove
   *   - Must match both roleId AND campusId to remove the assignment
   */
  async execute(
    userId: string,
    roleAssignments: RemoveRolesFromUserInput[],
  ): Promise<void> {
    try {
      // 1. Validate user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new UserNotFoundException(userId);
      }

      // 2. Validate all roles exist
      for (const assignment of roleAssignments) {
        const role = await this.roleRepository.findById(assignment.roleId);
        if (!role) {
          throw new RoleNotFoundException(assignment.roleId);
        }
      }

      // 3. Convert to repository format
      const repositoryAssignments: RoleAssignmentInput[] = roleAssignments.map(
        (a) => ({
          roleId: a.roleId,
          campusId: a.campusId ?? null,
        }),
      );

      // 4. Remove roles
      await this.userRepository.removeRoles(userId, repositoryAssignments);
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
