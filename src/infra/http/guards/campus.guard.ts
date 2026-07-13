/**
 * Campus Guard
 *
 * Validates campus context and user access to the specified campus.
 * Uses RequestContext for lazy-loaded, cached user data.
 *
 * Responsibilities:
 * - Extract campus ID from request (header > params > query)
 * - Validate campus exists and is active
 * - Verify user has access to the campus
 * - Set validated campus ID on RequestContext
 *
 * @example
 * ```typescript
 * @UseGuards(ClerkAuthGuard, CampusGuard)
 * @RequireCampusAccess({ required: true })
 * @Get('students')
 * async getStudents() { ... }
 * ```
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { RequestContext } from "../context/request-context.service";
import {
  getCampusFromRequest,
  setCampusOnRequest,
  hasCampusAccess,
  hasActiveStaffProfileInCampus,
  isValidUUID,
  isGlobalAdmin,
} from "../context/campus-context";
import {
  REQUIRE_CAMPUS_ACCESS_KEY,
  RequireCampusAccessOptions,
} from "../decorators/require-campus-access.decorator";
import { canGuardianReadCmsRoute } from "./cms-route-visibility.guard";

@Injectable()
export class CampusGuard implements CanActivate {
  private readonly logger = new Logger(CampusGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
    private readonly requestContext: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get decorator options
    const options =
      this.reflector.getAllAndOverride<RequireCampusAccessOptions>(
        REQUIRE_CAMPUS_ACCESS_KEY,
        [context.getHandler(), context.getClass()],
      );

    // Default options
    const {
      required = true,
      requireActive = true,
      checkUserAccess = true,
      allowGlobalAdmin = true,
    } = options || {};

    const request = context.switchToHttp().getRequest();

    // Extract campus ID from request
    const campusId = getCampusFromRequest(request);

    // Validate campus ID presence
    if (!campusId) {
      if (required) {
        this.logger.warn("CampusGuard: Campus context is required but missing");
        throw new BadRequestException(
          "Campus context is required. Provide X-Campus-Id header or campusId parameter.",
        );
      }
      // Not required, allow access without campus context
      setCampusOnRequest(request, null);
      this.requestContext.setCampusId(null);
      return true;
    }

    // Validate UUID format
    if (!isValidUUID(campusId)) {
      this.logger.warn(`CampusGuard: Invalid campus ID format: ${campusId}`);
      throw new BadRequestException("Invalid campus ID format");
    }

    // Check if campus exists
    const campus = await this.campusRepository.findById(campusId);
    if (!campus) {
      this.logger.warn(`CampusGuard: Campus not found: ${campusId}`);
      throw new NotFoundException(`Campus not found: ${campusId}`);
    }

    // Check if campus is archived
    if (requireActive && campus.isArchived) {
      this.logger.warn(`CampusGuard: Campus is archived: ${campusId}`);
      throw new ForbiddenException("Campus is archived");
    }

    // Check user access to campus
    if (checkUserAccess) {
      // Get clerkId from RequestContext (set by AuthMiddleware)
      const clerkId = this.requestContext.clerkId;
      if (!clerkId) {
        this.logger.warn("CampusGuard: No clerkId found in request context");
        throw new ForbiddenException("Authentication required");
      }

      // Get user from RequestContext (lazy-loaded, cached)
      const fullUser = await this.requestContext.getUser();
      if (!fullUser) {
        this.logger.warn(`CampusGuard: User not found for clerkId: ${clerkId}`);
        throw new ForbiddenException("User not found");
      }

      // Check if user is a global admin (bypasses campus-specific checks)
      if (allowGlobalAdmin && isGlobalAdmin(fullUser)) {
        this.logger.debug(
          `CampusGuard: Global admin ${fullUser.id} accessing campus ${campusId}`,
        );
        setCampusOnRequest(request, campusId);
        this.requestContext.setCampusId(campusId);
        return true;
      }

      if (
        canGuardianReadCmsRoute(this.reflector, context, fullUser, campusId)
      ) {
        setCampusOnRequest(request, campusId);
        this.requestContext.setCampusId(campusId);
        return true;
      }

      if (!hasActiveStaffProfileInCampus(fullUser, campusId)) {
        this.logger.warn(
          `CampusGuard: User ${fullUser.id} has no active staff profile in campus ${campusId}`,
        );
        throw new ForbiddenException(
          "Active staff profile required for this campus",
        );
      }

      // Check if user has access to this campus
      if (!hasCampusAccess(fullUser, campusId)) {
        this.logger.warn(
          `CampusGuard: User ${fullUser.id} has no access to campus ${campusId}`,
        );
        throw new ForbiddenException("No access to this campus");
      }
    }

    // Store validated campus ID on request and context for downstream use
    setCampusOnRequest(request, campusId);
    this.requestContext.setCampusId(campusId);

    this.logger.debug(`CampusGuard: Access granted for campus ${campusId}`);
    return true;
  }
}
