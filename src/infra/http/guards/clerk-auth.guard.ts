import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticationPort } from '@/application/ports/authentication.port';

/**
 * Clerk Authentication Guard
 *
 * HTTP layer guard that verifies authentication using AuthenticationPort.
 * This guard follows Clean Architecture principles by depending on an
 * abstraction (port) rather than a concrete implementation.
 *
 * Benefits:
 * - Testable: Can easily mock AuthenticationPort
 * - Flexible: Can switch authentication providers without changing this guard
 * - Follows Dependency Inversion Principle
 *
 * @example
 * // Apply to controller:
 * @UseGuards(ClerkAuthGuard)
 * @Controller('users')
 * class UserController { ... }
 *
 * // Apply to route:
 * @UseGuards(ClerkAuthGuard)
 * @Get(':id')
 * async findOne() { ... }
 *
 * // Skip authentication with @Public() decorator:
 * @Public()
 * @Get('health')
 * async health() { ... }
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    @Inject('AUTHENTICATION_PORT')
    private readonly authenticationPort: AuthenticationPort,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Verify authentication using AuthenticationPort
   *
   * @param context - Execution context containing HTTP request
   * @returns true if authenticated, false otherwise
   * @throws UnauthorizedException if authentication fails
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    try {
      // Verify authentication using port (abstraction)
      const result = await this.authenticationPort.verifyAuthentication(
        request,
      );

      if (!result.isAuthenticated || !result.userId) {
        this.logger.warn(
          `Authentication failed: ${result.error || 'No user ID'}`,
        );
        throw new UnauthorizedException(
          result.error || 'Authentication required',
        );
      }

      // Enrich request with authenticated user information
      request.clerkId = result.userId;
      request.sessionId = result.sessionId;

      this.logger.debug(`User authenticated: ${result.userId}`);
      return true;
    } catch (error) {
      // Log error and deny access
      this.logger.error('Authentication error', error);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }
}
