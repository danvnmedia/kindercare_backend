/**
 * Permissions Guard
 *
 * Validates that the authenticated user has at least one of the required
 * permissions within the current campus context.
 *
 * Uses RequestContext for:
 * - Cached user data (no duplicate DB fetches)
 * - Campus context (validated by CampusGuard)
 *
 * Permission Resolution:
 * - Collects permissions from all roles applicable to the current campus
 * - Roles include globally assigned (campusId = null) and campus-specific
 * - Uses OR logic: user needs ANY of the required permissions
 *
 * @example
 * ```typescript
 * @UseGuards(ClerkAuthGuard, CampusGuard, PermissionsGuard)
 * @Permissions('student.create', 'student.update')
 * @Post('students')
 * async createStudent() { ... }
 * ```
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { RequestContext } from "../context/request-context.service";

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly requestContext: RequestContext,
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

    // Get user from RequestContext (lazy-loaded, cached)
    const user = await this.requestContext.getUser();

    if (!user) {
      this.logger.warn("PermissionsGuard: No user found in request context");
      return false;
    }

    // Get campus context from RequestContext (set by CampusGuard)
    const campusId = this.requestContext.campusId;

    // Get roles that apply to the current campus context
    // This includes globally assigned roles (campusId = null) + campus-specific roles
    const applicableRoles = user.getRolesForCampus(campusId);

    if (applicableRoles.length === 0) {
      this.logger.warn(
        `PermissionsGuard: User ${user.id} has no roles assigned for campus ${campusId ?? "global"}`,
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
        `PermissionsGuard: User ${user.id} with permissions [${Array.from(userPermissionIds).join(", ")}] in campus ${campusId ?? "global"} does not have any of required permissions [${requiredPermissions.join(", ")}]`,
      );
    } else {
      this.logger.debug(
        `PermissionsGuard: User ${user.id} has required permission in campus ${campusId ?? "global"}`,
      );
    }

    return hasRequiredPermission;
  }
}
