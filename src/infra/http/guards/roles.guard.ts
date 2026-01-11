import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import {
  getCampusFromRequest,
  getValidatedCampusId,
} from "../context/campus-context";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true; // No roles specified, access granted
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // User object should be attached by a previous authentication guard

    if (!user) {
      this.logger.warn("RolesGuard: No user found in request");
      return false;
    }

    // Get campus context - prefer validated campus from CampusGuard, fallback to extraction
    const campusId =
      getValidatedCampusId(request) ?? getCampusFromRequest(request);

    // Fetch user with role assignments from the repository
    const fullUser = await this.userRepository.findById(user.id);

    if (!fullUser) {
      this.logger.warn(`User ${user.id} not found`);
      return false;
    }

    // Get roles that apply to the current campus context
    // This includes globally assigned roles (campusId = null) + campus-specific roles
    const applicableRoles = fullUser.getRolesForCampus(campusId);

    if (applicableRoles.length === 0) {
      this.logger.warn(
        `User ${user.id} has no roles assigned for campus ${campusId ?? "global"}`,
      );
      return false;
    }

    const hasRequiredRole = applicableRoles.some((role) =>
      requiredRoles.includes(role.name),
    );

    if (!hasRequiredRole) {
      this.logger.warn(
        `User ${user.id} with roles [${applicableRoles.map((r) => r.name).join(", ")}] in campus ${campusId ?? "global"} does not have required roles [${requiredRoles.join(", ")}]`,
      );
    }

    return hasRequiredRole;
  }
}
