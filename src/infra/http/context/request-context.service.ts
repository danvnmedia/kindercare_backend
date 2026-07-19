/**
 * Request Context Service
 *
 * Request-scoped service that provides lazy-loaded, cached authentication context.
 * This service is the foundation of the hybrid middleware + request-scoped pattern.
 *
 * Key Features:
 * - Request-scoped: One instance per HTTP request
 * - Lazy loading: User data fetched only when needed
 * - Caching: User fetched once per request, subsequent calls return cached data
 * - Type-safe: Provides typed access to user, clerkId, campusId
 *
 * Usage:
 * - AuthMiddleware sets clerkId/sessionId
 * - Guards/Controllers call getUser() which lazy-loads and caches
 * - CampusGuard calls setCampusId() after validation
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class SomeGuard implements CanActivate {
 *   constructor(private readonly requestContext: RequestContext) {}
 *
 *   async canActivate(): Promise<boolean> {
 *     const user = await this.requestContext.getUser(); // Lazy-loaded, cached
 *     return user?.hasRole('admin') ?? false;
 *   }
 * }
 * ```
 */

import {
  Injectable,
  Scope,
  Inject,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { Request } from "express";
import { User } from "@/domain/user-management/user.entity";
import { UserRepository } from "@/application/user-management/ports/user.repository";

/**
 * Extended Express Request with authentication properties
 */
export interface AuthenticatedRequest extends Request {
  clerkId?: string;
  sessionId?: string;
  campusId?: string | null;
  user?: User;
}

@Injectable({ scope: Scope.REQUEST })
export class RequestContext {
  private readonly logger = new Logger(RequestContext.name);

  /**
   * Cached user entity - null means not fetched yet, undefined means fetched but not found
   */
  private cachedUser: User | null | undefined = null;

  /**
   * Flag indicating whether user has been fetched (for distinguishing null from not-fetched)
   */
  private userLoaded = false;

  /**
   * Clerk user ID from authentication
   */
  private _clerkId: string | null = null;

  /**
   * Session ID from authentication
   */
  private _sessionId: string | null = null;

  /**
   * Validated campus ID (set by CampusGuard after validation)
   */
  private _campusId: string | null = null;

  constructor(
    @Inject(REQUEST)
    private readonly request: AuthenticatedRequest,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {
    // Initialize from request if middleware has already set values
    this._clerkId = request.clerkId ?? null;
    this._sessionId = request.sessionId ?? null;
    this._campusId = request.campusId ?? null;

    // If user was already set by previous guard, use it as cache
    if (request.user) {
      this.cachedUser = request.user;
      this.userLoaded = true;
    }
  }

  /**
   * Get the Clerk user ID
   */
  get clerkId(): string | null {
    return this._clerkId;
  }

  /**
   * Get the session ID
   */
  get sessionId(): string | null {
    return this._sessionId;
  }

  /**
   * Get the validated campus ID
   */
  get campusId(): string | null {
    return this._campusId;
  }

  /**
   * Set the Clerk user ID (called by AuthMiddleware)
   * Also syncs to request object for backward compatibility
   */
  setClerkId(clerkId: string): void {
    this._clerkId = clerkId;
    this.request.clerkId = clerkId;
  }

  /**
   * Set the session ID (called by AuthMiddleware)
   * Also syncs to request object for backward compatibility
   */
  setSessionId(sessionId: string): void {
    this._sessionId = sessionId;
    this.request.sessionId = sessionId;
  }

  /**
   * Set the validated campus ID (called by CampusGuard)
   * Also syncs to request object for backward compatibility
   */
  setCampusId(campusId: string | null): void {
    this._campusId = campusId;
    this.request.campusId = campusId;
  }

  /**
   * Check if the request is authenticated
   */
  isAuthenticated(): boolean {
    return this._clerkId !== null;
  }

  /**
   * Get the current user with lazy loading and caching
   *
   * First call fetches user from database, subsequent calls return cached value.
   * Returns null if not authenticated or user not found.
   *
   * @returns The User entity or null
   */
  async getUser(): Promise<User | null> {
    // Return cached user if already loaded
    if (this.userLoaded) {
      if (this.cachedUser) {
        this.assertUserActive(this.cachedUser);
      }

      return this.cachedUser ?? null;
    }

    // No clerkId means not authenticated
    if (!this._clerkId) {
      this.userLoaded = true;
      this.cachedUser = undefined;
      return null;
    }

    try {
      // Fetch the local application identity. A valid Clerk session is enough
      // to create a base User, but it never grants a role, profile, campus, or
      // permission. Those authorization records remain explicit admin flows.
      let user = await this.userRepository.findByClerkUid(this._clerkId);

      if (!user) {
        user = await this.provisionBaseUser(this._clerkId);
      }

      if (user) {
        this.assertUserActive(user);
      }

      // Cache the result
      this.cachedUser = user ?? undefined;
      this.userLoaded = true;

      // Sync to request object for backward compatibility with decorators
      if (user) {
        this.request.user = user;
      }

      return user;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.userLoaded = true;
        this.cachedUser = undefined;
        throw error;
      }

      this.logger.error(
        `Failed to fetch user for clerkId ${this._clerkId}`,
        error,
      );
      this.userLoaded = true;
      this.cachedUser = undefined;
      return null;
    }
  }

  /**
   * Get the current user or throw UnauthorizedException
   *
   * @throws UnauthorizedException if not authenticated or user not found
   */
  async getUserOrFail(): Promise<User> {
    const user = await this.getUser();

    if (!user) {
      throw new UnauthorizedException(
        this._clerkId ? "User not found" : "Authentication required",
      );
    }

    return user;
  }

  /**
   * Get user ID without fetching full user entity
   * Useful when only the ID is needed (e.g., for audit logging)
   */
  async getUserId(): Promise<string | null> {
    const user = await this.getUser();
    return user?.id ?? null;
  }

  /**
   * Check if user data has been loaded (regardless of whether user was found)
   */
  isUserLoaded(): boolean {
    return this.userLoaded;
  }

  /**
   * Clear cached user data (useful for testing or forcing refresh)
   * Note: In production, the request-scoped nature means this is rarely needed
   */
  clearCache(): void {
    this.cachedUser = null;
    this.userLoaded = false;
  }

  private assertUserActive(user: User): void {
    if (user.isActive) {
      return;
    }

    this.logger.warn(`Inactive user attempted access: ${user.id}`);
    throw new UnauthorizedException("User account is inactive");
  }

  /**
   * Create the local identity for a successfully authenticated Clerk user.
   *
   * Multiple frontend queries can arrive concurrently after sign-in. If a
   * sibling request wins the unique clerkUid race, reload and reuse that row.
   */
  private async provisionBaseUser(clerkUid: string): Promise<User> {
    try {
      const user = await this.userRepository.save(User.create({ clerkUid }));
      this.logger.log(`Provisioned base user for Clerk identity: ${clerkUid}`);
      return user;
    } catch (error) {
      const concurrentUser = await this.userRepository.findByClerkUid(clerkUid);

      if (concurrentUser) {
        this.logger.debug(
          `Base user already provisioned by a concurrent request: ${clerkUid}`,
        );
        return concurrentUser;
      }

      throw error;
    }
  }
}
