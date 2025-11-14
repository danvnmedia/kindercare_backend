/**
 * Authentication Port (Interface)
 *
 * Defines the contract for authentication services.
 * This follows the Dependency Inversion Principle - high-level modules
 * (Guards, Use Cases) depend on this abstraction, not on concrete implementations.
 *
 * @example
 * // Infrastructure layer implements this interface:
 * class ClerkAuthenticationAdapter implements AuthenticationPort { ... }
 *
 * // Presentation layer depends on this interface:
 * class ClerkAuthGuard {
 *   constructor(@Inject('AUTHENTICATION_PORT') private auth: AuthenticationPort) {}
 * }
 */

/**
 * Result of authentication verification
 */
export interface AuthenticationResult {
  /**
   * Whether the request is authenticated
   */
  isAuthenticated: boolean;

  /**
   * User identifier from the authentication provider
   * (e.g., Clerk userId)
   */
  userId: string | null;

  /**
   * Optional session ID or token ID
   */
  sessionId?: string;

  /**
   * Optional error message if authentication failed
   */
  error?: string;
}

/**
 * Authentication Port
 *
 * Port for verifying authentication status of incoming requests.
 * Infrastructure adapters (Clerk, Auth0, Firebase, etc.) implement this interface.
 */
export interface AuthenticationPort {
  /**
   * Verify authentication from an HTTP request
   *
   * @param request - HTTP request object (Express Request)
   * @returns Authentication result with user identifier
   *
   * @example
   * const result = await authPort.verifyAuthentication(request);
   * if (result.isAuthenticated) {
   *   console.log('User ID:', result.userId);
   * }
   */
  verifyAuthentication(request: any): Promise<AuthenticationResult>;
}
