/**
 * Authentication Middleware
 *
 * Middleware that validates Clerk authentication tokens and sets authentication
 * context on the request. Runs before guards to provide early authentication.
 *
 * Key Characteristics:
 * - Non-blocking: Does not throw errors on authentication failure
 * - Sets clerkId/sessionId on request for downstream consumption
 * - Guards handle authorization decisions (this only does authentication)
 *
 * Flow:
 * 1. Middleware verifies token via AuthenticationPort
 * 2. On success: sets request.clerkId and request.sessionId
 * 3. On failure: silently continues (guards will handle authorization)
 * 4. Always calls next() to continue request pipeline
 *
 * This pattern allows:
 * - Public routes to work without authentication
 * - Guards to make authorization decisions with authentication context available
 * - Single point of token verification (not repeated in guards)
 *
 * @example
 * ```typescript
 * // In HttpModule:
 * export class HttpModule implements NestModule {
 *   configure(consumer: MiddlewareConsumer) {
 *     consumer.apply(AuthMiddleware).forRoutes('*');
 *   }
 * }
 * ```
 */

import { Injectable, NestMiddleware, Inject, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { AuthenticationPort } from "@/application/ports/authentication.port";

/**
 * Extended Request type with authentication properties
 */
interface AuthenticatedRequest extends Request {
  clerkId?: string;
  sessionId?: string;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(
    @Inject("AUTHENTICATION_PORT")
    private readonly authenticationPort: AuthenticationPort,
  ) {}

  /**
   * Middleware handler
   *
   * Attempts to verify authentication and sets context on request.
   * Always continues to next middleware/handler regardless of auth result.
   */
  async use(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      // Verify authentication using the port abstraction
      const result = await this.authenticationPort.verifyAuthentication(req);

      if (result.isAuthenticated && result.userId) {
        // Set authentication context on request
        req.clerkId = result.userId;
        req.sessionId = result.sessionId;

        this.logger.debug(`Authentication verified for user: ${result.userId}`);
      } else {
        // Not authenticated - this is fine for public routes
        this.logger.debug(
          `No authentication found: ${result.error ?? "No token provided"}`,
        );
      }
    } catch (error) {
      // Log error but don't block the request
      // Guards will handle authorization decisions
      this.logger.debug(
        `Authentication verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    // Always continue to next handler
    next();
  }
}
