import { Injectable, Logger } from '@nestjs/common';
import { getAuth } from '@clerk/express';
import {
  AuthenticationPort,
  AuthenticationResult,
} from '@/application/ports/authentication.port';

/**
 * Clerk Authentication Adapter
 *
 * Infrastructure adapter that implements AuthenticationPort using Clerk SDK.
 * This adapter bridges the gap between our application's authentication
 * abstraction and Clerk's concrete implementation.
 *
 * Following Clean Architecture:
 * - Implements port interface from application layer
 * - Contains all Clerk-specific logic
 * - Can be swapped with other authentication providers (Auth0, Firebase, etc.)
 *   without affecting application logic
 *
 * @example
 * // In ClerkModule:
 * {
 *   provide: 'AUTHENTICATION_PORT',
 *   useClass: ClerkAuthenticationAdapter,
 * }
 */
@Injectable()
export class ClerkAuthenticationAdapter implements AuthenticationPort {
  private readonly logger = new Logger(ClerkAuthenticationAdapter.name);

  /**
   * Verify authentication using Clerk SDK
   *
   * Uses @clerk/express getAuth() to extract authentication information
   * from the request. This assumes clerkMiddleware() has been applied
   * globally in main.ts.
   *
   * @param request - Express request object with Clerk auth context
   * @returns Authentication result with Clerk userId
   */
  async verifyAuthentication(request: any): Promise<AuthenticationResult> {
    try {
      // Extract auth information from Clerk middleware
      const { userId, sessionId } = getAuth(request);

      // Check if user is authenticated
      if (!userId) {
        this.logger.debug('Authentication failed: No userId from Clerk');
        return {
          isAuthenticated: false,
          userId: null,
          error: 'No valid authentication token',
        };
      }

      this.logger.debug(`User authenticated successfully: ${userId}`);

      return {
        isAuthenticated: true,
        userId,
        sessionId: sessionId || undefined,
      };
    } catch (error) {
      // Handle unexpected errors from Clerk SDK
      this.logger.error('Error during authentication verification', error);

      return {
        isAuthenticated: false,
        userId: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
