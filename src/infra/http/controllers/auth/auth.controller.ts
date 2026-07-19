import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { AuthMeResponse } from "../../dtos/auth/auth-me.response";
import { User } from "@/domain/user-management/user.entity";
import { RequestContext } from "../../context/request-context.service";

/**
 * Authentication Controller
 *
 * Handles authentication-related endpoints.
 * Uses ClerkAuthGuard for authorization check (AuthMiddleware handles token verification).
 *
 * Request Flow:
 * 1. AuthMiddleware verifies Clerk token and sets clerkId
 * 2. ClerkAuthGuard checks clerkId exists (rejects unauthenticated requests)
 * 3. RequestContext lazily loads or provisions a role-free base user
 *
 * @example
 * GET /auth/me
 * Authorization: Bearer <clerk_session_token>
 */
@Controller("auth")
@ApiTags("Authentication")
@ApiBearerAuth("JWT")
export class AuthController {
  constructor(private readonly requestContext: RequestContext) {}

  /**
   * Get Current Authenticated User
   *
   * Verifies the access token and returns the authenticated user's information.
   * This endpoint is useful for:
   * - Verifying if the access token is still valid
   * - Getting the current user's profile
   * - Checking user roles and permissions
   *
   * @returns User information with roles
   *
   * A first-time Clerk user receives a local base identity with no roles,
   * profiles, campuses, or permissions. Application access is granted later
   * through the existing Staff/Guardian and role assignment flows.
   *
   * @throws UnauthorizedException if token is invalid or account is inactive
   *
   * @example
   * ```bash
   * curl -X GET http://localhost:3000/auth/me \
   *   -H "Authorization: Bearer <your_clerk_session_token>"
   * ```
   */
  @Get("me")
  @UseGuards(ClerkAuthGuard)
  @StandardResponse({
    message: "User information retrieved successfully",
    type: AuthMeResponse,
  })
  @ApiOperation({
    summary: "Get current authenticated user",
    description:
      "Verify access token and return authenticated user information with roles",
  })
  async getCurrentUser(): Promise<User> {
    // RequestContext lazy-loads or provisions a role-free local identity.
    return this.requestContext.getUserOrFail();
  }
}
