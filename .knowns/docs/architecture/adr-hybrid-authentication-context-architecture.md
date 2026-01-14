---
title: 'Hybrid Authentication Context Architecture'
createdAt: '2026-01-14T08:06:40.591Z'
updatedAt: '2026-01-14T10:45:00.000Z'
description: >-
  Architecture documentation for the hybrid middleware + request-scoped service
  pattern used for authentication context management
tags:
  - architecture
  - authentication
  - nestjs
  - guards
---
# Hybrid Authentication Context Architecture

## Overview

The application uses a **hybrid middleware + request-scoped service** pattern for authentication context management. This architecture combines:

1. **AuthMiddleware** - Fast, early token verification
2. **RequestContext Service** - Lazy-loaded, cached user data access
3. **Guards** - Authorization decisions using cached context

This pattern ensures **single database fetch per request** while providing type-safe authentication context throughout the request lifecycle.

## Architecture Diagram

```
HTTP Request (with Bearer token)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. AuthMiddleware (Global)                                  │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ • Verify Clerk token via AuthenticationPort         │  │
│    │ • Set request.clerkId and request.sessionId         │  │
│    │ • Non-blocking: continues on failure (for public)   │  │
│    │ • Does NOT fetch user from database                 │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. RequestContext Instantiation (Request-Scoped)            │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ • New instance created for each HTTP request        │  │
│    │ • Initialized with clerkId/sessionId from request   │  │
│    │ • User NOT loaded yet (lazy loading)                │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Guards (Use RequestContext)                              │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ ClerkAuthGuard:                                     │  │
│    │   • Check requestContext.clerkId exists             │  │
│    │   • Reject if not authenticated (unless @Public)    │  │
│    ├─────────────────────────────────────────────────────┤  │
│    │ CampusGuard (@RequireCampusAccess):                 │  │
│    │   • Extract campusId from request                   │  │
│    │   • Validate campus exists and is active            │  │
│    │   • Call requestContext.getUser() → DB FETCH        │  │
│    │   • Check user has access to campus                 │  │
│    │   • Set requestContext.campusId                     │  │
│    ├─────────────────────────────────────────────────────┤  │
│    │ RolesGuard / PermissionsGuard:                      │  │
│    │   • Call requestContext.getUser() → CACHED          │  │
│    │   • Check user roles/permissions                    │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Controller                                               │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ • @CurrentUser() decorator → request.user (cached)  │  │
│    │ • @CampusContext() → requestContext.campusId        │  │
│    │ • Process request and delegate to Use Case          │  │
│    └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. AuthMiddleware

**Location:** `src/infra/http/middleware/auth.middleware.ts`

The AuthMiddleware runs first on every request. Its responsibilities are:

- Verify Clerk authentication token
- Set `clerkId` and `sessionId` on the request object
- **Never block requests** - authentication failures are handled by guards

```typescript
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject("AUTHENTICATION_PORT")
    private readonly authenticationPort: AuthenticationPort,
  ) {}

  async use(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.authenticationPort.verifyAuthentication(req);

      if (result.isAuthenticated && result.userId) {
        req.clerkId = result.userId;
        req.sessionId = result.sessionId;
      }
    } catch (error) {
      // Log but don't block - guards handle authorization
    }

    next(); // Always continue
  }
}
```

**Key Characteristics:**
- Non-blocking: Always calls `next()`
- Lightweight: Only token verification, no DB calls
- Runs on all routes: `forRoutes('*')`

### 2. RequestContext Service

**Location:** `src/infra/http/context/request-context.service.ts`

The RequestContext is a request-scoped service that provides:

- **Lazy loading**: User fetched only when `getUser()` is called
- **Caching**: Single DB fetch per request, cached for subsequent calls
- **Type-safe access**: Typed properties for `user`, `clerkId`, `campusId`

```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestContext {
  private cachedUser: User | null | undefined = null;
  private userLoaded = false;
  private _clerkId: string | null = null;
  private _campusId: string | null = null;

  constructor(
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    @Inject("USER_REPOSITORY") private readonly userRepository: UserRepository,
  ) {
    // Initialize from request (set by AuthMiddleware)
    this._clerkId = request.clerkId ?? null;
  }

  // Lazy-loaded, cached user access
  async getUser(): Promise<User | null> {
    if (this.userLoaded) {
      return this.cachedUser ?? null; // Return cached
    }

    if (!this._clerkId) {
      this.userLoaded = true;
      return null;
    }

    // Fetch from database (only happens once)
    const user = await this.userRepository.findByClerkUid(this._clerkId);
    this.cachedUser = user ?? undefined;
    this.userLoaded = true;

    // Sync to request for decorators
    if (user) this.request.user = user;

    return user;
  }

  // Getters for authentication context
  get clerkId(): string | null { return this._clerkId; }
  get campusId(): string | null { return this._campusId; }

  // Setters for guards to update context
  setCampusId(campusId: string | null): void {
    this._campusId = campusId;
    this.request.campusId = campusId;
  }
}
```

**API:**

| Method | Description |
|--------|-------------|
| `getUser()` | Lazy-load and cache user from DB |
| `getUserOrFail()` | Get user or throw UnauthorizedException |
| `getUserId()` | Get user ID (triggers user load) |
| `isAuthenticated()` | Check if clerkId is set |
| `isUserLoaded()` | Check if user has been fetched |
| `clerkId` | Get Clerk user ID |
| `sessionId` | Get session ID |
| `campusId` | Get validated campus ID |
| `setCampusId()` | Set campus ID (called by CampusGuard) |
| `clearCache()` | Clear cached user (for testing) |

### 3. RequestContextModule

**Location:** `src/infra/http/context/request-context.module.ts`

```typescript
@Module({
  imports: [
    PrismaModule,
    StandardResponseModule,
  ],
  providers: [
    RequestContext,
    {
      provide: "USER_REPOSITORY",
      useClass: PrismaUserRepository,
    },
  ],
  exports: [RequestContext, "USER_REPOSITORY"],
})
export class RequestContextModule {}
```

**Import Requirements:**

Any module with controllers using guards that depend on `RequestContext` must import `RequestContextModule`:

```typescript
@Module({
  imports: [
    RequestContextModule, // Required for ClerkAuthGuard, CampusGuard, etc.
    // ... other imports
  ],
})
export class SomeFeatureModule {}
```

## Guards

### ClerkAuthGuard

**Location:** `src/infra/http/guards/clerk-auth.guard.ts`

Ensures request is authenticated (unless route is marked `@Public()`).

```typescript
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly requestContext: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const clerkId = this.requestContext.clerkId;
    if (!clerkId) {
      throw new UnauthorizedException("Authentication required");
    }

    return true;
  }
}
```

### CampusGuard

**Location:** `src/infra/http/guards/campus.guard.ts`

Validates campus access when `@RequireCampusAccess()` decorator is applied.

```typescript
@Injectable()
export class CampusGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject("CAMPUS_REPOSITORY") private readonly campusRepository: CampusRepository,
    private readonly requestContext: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Extract and validate campus ID from request
    const campusId = this.extractCampusId(request);

    // Validate campus exists and is active
    const campus = await this.campusRepository.findById(campusId);

    // Get user from RequestContext (lazy-loaded, cached)
    const user = await this.requestContext.getUser();

    // Check user has access to this campus
    const hasAccess = this.checkUserCampusAccess(user, campus, options);

    // Set campus ID in context for downstream use
    this.requestContext.setCampusId(campusId);

    return hasAccess;
  }
}
```

### RolesGuard / PermissionsGuard

**Location:** `src/infra/http/guards/roles.guard.ts`, `permissions.guard.ts`

These guards use the cached user from `RequestContext`:

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly requestContext: RequestContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [...]);

    // User already cached by CampusGuard - no DB call
    const user = await this.requestContext.getUser();
    const campusId = this.requestContext.campusId;

    // Check roles for this campus
    return this.checkUserRoles(user, requiredRoles, campusId);
  }
}
```

## Usage Patterns

### Controller with Authentication

```typescript
@Controller("posts")
@ApiTags("Posts")
@UseGuards(ClerkAuthGuard) // Requires authentication
export class PostController {
  @Post()
  @RequireCampusAccess() // Requires campus context
  async create(
    @CurrentUser() user: User,           // From request.user (cached)
    @CampusContext() campusId: string,   // From requestContext.campusId
    @Body() dto: CreatePostRequest,
  ) {
    return this.createPostUseCase.execute({
      ...dto,
      authorId: user.id,
      campusId,
    });
  }
}
```

### Guard Execution Order

When multiple guards are applied:

```typescript
@UseGuards(ClerkAuthGuard)  // 1. Check authenticated
@RequireCampusAccess()      // 2. Validate campus (triggers user load)
@Roles('admin', 'teacher')  // 3. Check roles (uses cached user)
```

| Guard | DB Calls | Notes |
|-------|----------|-------|
| ClerkAuthGuard | 0 | Only checks clerkId exists |
| CampusGuard | 1 | Fetches user via `getUser()` |
| RolesGuard | 0 | Uses cached user |
| PermissionsGuard | 0 | Uses cached user |

**Total: 1 DB call** (vs 3-4 in previous architecture)

### Injecting RequestContext in Services

```typescript
@Injectable()
export class AuditService {
  constructor(private readonly requestContext: RequestContext) {}

  async logAction(action: string, resourceId: string): Promise<void> {
    const user = await this.requestContext.getUser();
    const campusId = this.requestContext.campusId;

    await this.auditRepository.save({
      action,
      resourceId,
      userId: user?.id,
      campusId,
      timestamp: new Date(),
    });
  }
}
```

## Module Configuration

### HttpModule Setup

The HttpModule applies AuthMiddleware globally:

```typescript
@Module({
  imports: [
    ClerkModule,        // Provides AUTHENTICATION_PORT
    AuthModule,
    UserManagementModule,
    FileManagementModule,
    // ... other feature modules
  ],
})
export class HttpModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
```

### Feature Module Requirements

Each feature module with protected routes must import `RequestContextModule`:

| Module | Imports RequestContextModule | Reason |
|--------|------------------------------|--------|
| AuthModule | Yes (direct) | ClerkAuthGuard |
| UserManagementModule | Yes (direct) | All guards |
| FileManagementModule | Yes (direct) | ClerkAuthGuard, CampusGuard |
| ClassManagementModule | Yes (direct) | CampusGuard |
| AttendanceModule | Yes (direct) | CampusGuard |
| ContentManagementModule | Via AuthModule | ClerkAuthGuard, CampusGuard |

## Performance Comparison

| Metric | Previous Architecture | Hybrid Architecture |
|--------|----------------------|---------------------|
| DB fetches per request | 3-4 | **1** |
| Token verifications | Multiple (per guard) | **1** (middleware) |
| User caching | None | **Request-scoped** |
| Context access | Raw request properties | **Type-safe service** |

## Decision Context

### Why This Pattern?

| Approach | Pros | Cons |
|----------|------|------|
| Middleware only | Simple, performant | Less DI integration |
| Request-scoped only | Clean DI | Overhead per request |
| JWT Claims | Zero DB calls | Stale data, sync issues |
| **Hybrid (chosen)** | Best of both worlds | Slightly more complex |

### Key Benefits

1. **Single DB fetch** - User loaded once, cached for request duration
2. **Clean separation** - Middleware handles auth, guards handle authorization
3. **Type safety** - RequestContext provides typed API
4. **Lazy loading** - Public routes don't trigger user fetch
5. **Testability** - Easy to mock RequestContext in tests

## Files Reference

| File | Purpose |
|------|---------|
| `src/infra/http/middleware/auth.middleware.ts` | Token verification |
| `src/infra/http/context/request-context.service.ts` | Request-scoped context |
| `src/infra/http/context/request-context.module.ts` | Module configuration |
| `src/infra/http/guards/clerk-auth.guard.ts` | Authentication guard |
| `src/infra/http/guards/campus.guard.ts` | Campus access guard |
| `src/infra/http/guards/roles.guard.ts` | Role-based authorization |
| `src/infra/http/guards/permissions.guard.ts` | Permission-based authorization |

## Related Documentation

- @doc/architecture/module-and-request-flow - Full request processing flow
- @doc/patterns/guards-pattern - Guards pattern documentation
- NestJS Request-Scoped Providers: https://docs.nestjs.com/fundamentals/injection-scopes
