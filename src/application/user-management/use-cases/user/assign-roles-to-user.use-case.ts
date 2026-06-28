import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  UserRepository,
  RoleAssignmentInput,
} from "../../ports/user.repository";
import { RoleRepository } from "../../ports/role.repository";
import { CampusRepository } from "../../../campus/ports/campus.repository";
import { UserNotFoundException } from "../../../../domain/user-management/exceptions/user-not-found.exception";
import { RoleNotFoundException } from "../../../../domain/user-management/exceptions/role-not-found.exception";

/**
 * Input for assigning roles to a user
 */
export interface AssignRolesToUserInput {
  roleId: string;
  campusId?: string | null; // null or undefined = global assignment
}

@Injectable()
export class AssignRolesToUserUseCase {
  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  /**
   * Assign roles to a user with optional campus context
   *
   * @param userId - The user to assign roles to
   * @param roleAssignments - Array of role assignments
   *   - roleId: The role to assign
   *   - campusId: Campus context (null/undefined for global assignment)
   */
  async execute(
    userId: string,
    roleAssignments: AssignRolesToUserInput[],
  ): Promise<void> {
    try {
      // 1. Validate user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new UserNotFoundException(userId);
      }

      // 2. Validate all roles and campuses exist
      for (const assignment of roleAssignments) {
        // Validate role exists
        const role = await this.roleRepository.findById(assignment.roleId);
        if (!role) {
          throw new RoleNotFoundException(assignment.roleId);
        }

        // Validate campus exists (if specified)
        if (assignment.campusId) {
          const campusExists = await this.campusRepository.exists(
            assignment.campusId,
          );
          if (!campusExists) {
            throw new BadRequestException(
              `Campus with ID ${assignment.campusId} not found`,
            );
          }
        }
      }

      // 3. Convert to repository format
      const repositoryAssignments: RoleAssignmentInput[] = roleAssignments.map(
        (a) => ({
          roleId: a.roleId,
          campusId: a.campusId ?? null,
        }),
      );

      // 4. Assign roles (repository handles idempotency)
      await this.userRepository.assignRoles(userId, repositoryAssignments);
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
