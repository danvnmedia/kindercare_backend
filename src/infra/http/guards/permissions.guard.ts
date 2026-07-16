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
import {
  getPermissionIdsForCampus,
  hasAnyPermission,
} from "@/application/rbac/permission-access";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { RequestContext } from "../context/request-context.service";
import { canGuardianReadCmsRoute } from "./cms-route-visibility.guard";

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

    if (user.hasSystemRole()) {
      return true;
    }

    // Get campus context from RequestContext (set by CampusGuard)
    const campusId = this.requestContext.campusId;

    if (canGuardianReadCmsRoute(this.reflector, context, user, campusId)) {
      return true;
    }

    // Get roles that apply to the current campus context
    // This includes globally assigned roles (campusId = null) + campus-specific roles
    const applicableRoles = user.getRolesForCampus(campusId);

    if (applicableRoles.length === 0) {
      this.logger.warn(
        `PermissionsGuard: User ${user.id} has no roles assigned for campus ${campusId ?? "global"}`,
      );
      return false;
    }

    const userPermissionIds = getPermissionIdsForCampus(user, campusId);

    // Keep exact permission checks centralized while preserving the CMS rule
    // that post.manage includes moderation/review capability.
    const hasRequiredPermission =
      hasAnyPermission(userPermissionIds, requiredPermissions) ||
      (requiredPermissions.includes("post.review") &&
        userPermissionIds.has("post.manage"));

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
