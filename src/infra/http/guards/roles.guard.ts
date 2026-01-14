/**
 * Roles Guard
 *
 * Validates that the authenticated user has at least one of the required roles
 * within the current campus context.
 *
 * Uses RequestContext for:
 * - Cached user data (no duplicate DB fetches)
 * - Campus context (validated by CampusGuard)
 *
 * Role Resolution:
 * - Checks roles assigned globally (campusId = null in assignment)
 * - Checks roles assigned to the current campus
 * - Uses OR logic: user needs ANY of the required roles
 *
 * @example
 * ```typescript
 * @UseGuards(ClerkAuthGuard, CampusGuard, RolesGuard)
 * @Roles('admin', 'manager')
 * @Get('reports')
 * async getReports() { ... }
 * ```
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { RequestContext } from "../context/request-context.service";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private readonly requestContext: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles specified, access granted
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get user from RequestContext (lazy-loaded, cached)
    const user = await this.requestContext.getUser();

    if (!user) {
      this.logger.warn("RolesGuard: No user found in request context");
      return false;
    }

    // Get campus context from RequestContext (set by CampusGuard)
    const campusId = this.requestContext.campusId;

    // Get roles that apply to the current campus context
    // This includes globally assigned roles (campusId = null) + campus-specific roles
    const applicableRoles = user.getRolesForCampus(campusId);

    if (applicableRoles.length === 0) {
      this.logger.warn(
        `RolesGuard: User ${user.id} has no roles assigned for campus ${campusId ?? "global"}`,
      );
      return false;
    }

    // Check if user has any of the required roles (OR logic)
    const hasRequiredRole = applicableRoles.some((role) =>
      requiredRoles.includes(role.name),
    );

    if (!hasRequiredRole) {
      this.logger.warn(
        `RolesGuard: User ${user.id} with roles [${applicableRoles.map((r) => r.name).join(", ")}] in campus ${campusId ?? "global"} does not have required roles [${requiredRoles.join(", ")}]`,
      );
    } else {
      this.logger.debug(
        `RolesGuard: User ${user.id} has required role in campus ${campusId ?? "global"}`,
      );
    }

    return hasRequiredRole;
  }
}
