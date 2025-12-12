import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { UserInterceptor } from "../../interceptors/user.interceptor";
import { CurrentUser } from "../../decorators/current-user.decorator";
import { AuthMeResponse } from "../../dtos/auth/auth-me.response";
import { User } from "@/domain/user-management/user.entity";

/**
 * Authentication Controller
 *
 * Handles authentication-related endpoints.
 * Uses ClerkAuthGuard for token verification and UserInterceptor to fetch user data.
 *
 * @example
 * GET /auth/me
 * Authorization: Bearer <clerk_session_token>
 */
@Controller("auth")
@ApiTags("Authentication")
@ApiBearerAuth("JWT")
export class AuthController {
  /**
   * Get Current Authenticated User
   *
   * Verifies the access token and returns the authenticated user's information.
   * This endpoint is useful for:
   * - Verifying if the access token is still valid
   * - Getting the current user's profile
   * - Checking user roles and permissions
   *
   * @param user - Current authenticated user (injected by UserInterceptor)
   * @returns User information with roles
   *
   * @throws UnauthorizedException if token is invalid or user not found
   *
   * @example
   * ```bash
   * curl -X GET http://localhost:3000/auth/me \
   *   -H "Authorization: Bearer <your_clerk_session_token>"
   * ```
   */
  @Get("me")
  @UseGuards(ClerkAuthGuard)
  @UseInterceptors(UserInterceptor)
  @StandardResponse({
    message: "User information retrieved successfully",
    type: AuthMeResponse,
  })
  @ApiOperation({
    summary: "Get current authenticated user",
    description:
      "Verify access token and return authenticated user information with roles",
  })
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    // If ClerkAuthGuard passes but UserInterceptor didn't find user in DB
    if (!user) {
      throw new UnauthorizedException(
        "User not found. Please ensure your account is properly set up.",
      );
    }

    return user;
  }
}
