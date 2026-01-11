import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { UserRepository } from "../../ports/user.repository";
import { Role } from "../../../../domain/user-management/role.entity";
import { UserNotFoundException } from "../../../../domain/user-management/exceptions/user-not-found.exception";

@Injectable()
export class GetUserRolesByCampusUseCase {
  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Get user roles for a specific campus context
   *
   * Returns:
   * - Roles assigned globally (campusId = null) - these apply everywhere
   * - Roles assigned specifically to the given campus
   *
   * @param userId - The user ID
   * @param campusId - The campus to get roles for (null for global roles only)
   */
  async execute(userId: string, campusId: string | null): Promise<Role[]> {
    try {
      // Validate user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new UserNotFoundException(userId);
      }

      // Get roles for the campus (includes global roles)
      return this.userRepository.getUserRolesForCampus(userId, campusId);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
