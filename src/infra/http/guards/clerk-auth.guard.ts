/**
 * Clerk Authentication Guard
 *
 * Authorization guard that verifies the request is authenticated.
 * Works in conjunction with AuthMiddleware which performs the actual token verification.
 *
 * Flow:
 * 1. AuthMiddleware verifies Clerk token and sets request.clerkId
 * 2. This guard checks if clerkId exists (authentication was successful)
 * 3. Public routes (marked with @Public()) bypass this check
 *
 * This separation allows:
 * - Middleware to handle authentication (token verification)
 * - Guard to handle authorization (route protection)
 * - Clean error handling and logging at appropriate layers
 *
 * @example
 * ```typescript
 * // Protected route (requires authentication)
 * @UseGuards(ClerkAuthGuard)
 * @Get('profile')
 * async getProfile() { ... }
 *
 * // Public route (no authentication required)
 * @Public()
 * @Get('health')
 * async health() { ... }
 * ```
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RequestContext } from "../context/request-context.service";

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContext,
  ) {}

  /**
   * Check if the request is authenticated
   *
   * @param context - Execution context containing HTTP request
   * @returns true if authenticated or route is public
   * @throws UnauthorizedException if authentication is required but missing
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Check if authentication context exists (set by AuthMiddleware)
    const clerkId = this.requestContext.clerkId;

    if (!clerkId) {
      this.logger.warn(
        "ClerkAuthGuard: Authentication required but no clerkId found",
      );
      throw new UnauthorizedException("Authentication required");
    }

    this.logger.debug(`ClerkAuthGuard: User authenticated: ${clerkId}`);
    return true;
  }
}
