/**
 * Campus Guard
 * Validates campus context and user access to the specified campus
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
import { UserRepository } from "@/application/user-management/ports/user.repository";
import {
  getCampusFromRequest,
  setCampusOnRequest,
  hasCampusAccess,
  isValidUUID,
  isGlobalAdmin,
} from "../context/campus-context";
import {
  REQUIRE_CAMPUS_ACCESS_KEY,
  RequireCampusAccessOptions,
} from "../decorators/require-campus-access.decorator";

@Injectable()
export class CampusGuard implements CanActivate {
  private readonly logger = new Logger(CampusGuard.name);

  constructor(
    private reflector: Reflector,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
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

    // Check if campus is active
    if (requireActive && !campus.isActive) {
      this.logger.warn(`CampusGuard: Campus is not active: ${campusId}`);
      throw new ForbiddenException("Campus is not active");
    }

    // Check user access to campus
    if (checkUserAccess) {
      const user = request.user;
      if (!user) {
        this.logger.warn("CampusGuard: No user found in request");
        throw new ForbiddenException("Authentication required");
      }

      // Fetch full user with role assignments
      const fullUser = await this.userRepository.findById(user.id);
      if (!fullUser) {
        this.logger.warn(`CampusGuard: User not found: ${user.id}`);
        throw new ForbiddenException("User not found");
      }

      // Check if user is a global admin (bypasses campus-specific checks)
      if (allowGlobalAdmin && isGlobalAdmin(fullUser)) {
        this.logger.debug(
          `CampusGuard: Global admin ${user.id} accessing campus ${campusId}`,
        );
        setCampusOnRequest(request, campusId);
        return true;
      }

      // Check if user has access to this campus
      if (!hasCampusAccess(fullUser, campusId)) {
        this.logger.warn(
          `CampusGuard: User ${user.id} has no access to campus ${campusId}`,
        );
        throw new ForbiddenException("No access to this campus");
      }
    }

    // Store validated campus ID on request for downstream use
    setCampusOnRequest(request, campusId);

    this.logger.debug(`CampusGuard: Access granted for campus ${campusId}`);
    return true;
  }
}
