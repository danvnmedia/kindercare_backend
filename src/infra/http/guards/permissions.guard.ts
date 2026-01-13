import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { UserRepository } from "@/application/user-management/ports/user.repository";
import {
  getCampusFromRequest,
  getValidatedCampusId,
} from "../context/campus-context";

/**
 * Guard that checks if user has required permissions within the current campus context
 *
 * Permissions are checked by looking at roles assigned to the user for the
 * current campus (including globally assigned roles) and collecting their
 * permissions. If user has ANY of the required permissions (OR logic),
 * access is granted.
 *
 * Campus context is determined from:
 * 1. x-campus-id header
 * 2. campusId route parameter
 * 3. campusId query parameter
 *
 * If no campus context is provided, only globally assigned roles are checked.
 *
 * Usage:
 * @UseGuards(ClerkAuthGuard, PermissionsGuard)
 * @Permissions('student.create', 'student.update')
 * async someMethod() { ... }
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required permissions from decorator metadata
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permissions specified, access granted
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn("PermissionsGuard: No user found in request");
      return false;
    }

    // Get campus context - prefer validated campus from CampusGuard, fallback to extraction
    const campusId =
      getValidatedCampusId(request) ?? getCampusFromRequest(request);

    // Fetch user with role assignments
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

    // Collect all permissions from applicable roles
    const userPermissionIds = new Set<string>();

    for (const role of applicableRoles) {
      if (role.permissions) {
        role.permissions.forEach((p) => userPermissionIds.add(p.id));
      }
    }

    // Check if user has ANY of the required permissions (OR logic)
    const hasRequiredPermission = requiredPermissions.some((permission) =>
      userPermissionIds.has(permission),
    );

    if (!hasRequiredPermission) {
      this.logger.warn(
        `User ${user.id} with permissions [${Array.from(userPermissionIds).join(", ")}] in campus ${campusId ?? "global"} does not have any of required permissions [${requiredPermissions.join(", ")}]`,
      );
    }

    return hasRequiredPermission;
  }
}
