import { Inject, Injectable, Logger } from '@nestjs/common';
import { type AuthObject, type ClerkClient } from '@clerk/backend';
import { createClerkRequest } from '@clerk/backend/internal';
import type { Request as ExpressRequest } from 'express';
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
  constructor(
    @Inject('ClerkClient') private readonly clerkClient: ClerkClient,
  ) {}

  /**
   * Verify authentication using Clerk SDK
   *
   * @param request - Express request object with Clerk auth context
   * @returns Authentication result with Clerk userId
   */
  async verifyAuthentication(request: ExpressRequest): Promise<AuthenticationResult> {
    try {
      const clerkRequest = this.createClerkRequest(request);
      const requestState = await this.clerkClient.authenticateRequest(
        clerkRequest,
        { acceptsToken: 'any' },
      );
      const authObject = requestState.toAuth();

      if (!isSignedInSessionAuthObject(authObject)) {
        this.logger.debug('Authentication failed: Missing authenticated user');
        return {
          isAuthenticated: false,
          userId: null,
          error: 'No valid authentication token',
        };
      }

      this.logger.debug(`User authenticated successfully: ${authObject.userId}`);

      return {
        isAuthenticated: true,
        userId: authObject.userId,
        sessionId: authObject.sessionId ?? undefined,
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

  /**
   * Convert an Express request into the Fetch API Request expected by the Clerk SDK.
   */
  private createClerkRequest(request: ExpressRequest) {
    const headers = new Headers();

    Object.entries(request.headers).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.filter(Boolean).forEach((val) => headers.append(key, val));
      } else if (value) {
        headers.append(key, value);
      }
    });

    const protocol =
      request.protocol ??
      ((request.socket as any)?.encrypted ? 'https' : 'http');
    const host = headers.get('host') ?? 'localhost';
    const url = new URL(request.originalUrl || request.url || '/', `${protocol}://${host}`);

    return createClerkRequest(
      new Request(url, {
        method: request.method,
        headers,
      }),
    );
  }
}

type SignedInSessionAuthObject = AuthObject & {
  isAuthenticated: true;
  tokenType: 'session_token';
  userId: string;
  sessionId?: string | null;
};

const isSignedInSessionAuthObject = (
  auth: AuthObject | null,
): auth is SignedInSessionAuthObject => {
  if (!auth || !auth.isAuthenticated || auth.tokenType !== 'session_token') {
    return false;
  }

  return typeof (auth as { userId?: unknown }).userId === 'string';
};
