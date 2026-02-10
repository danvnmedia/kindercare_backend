---
id: l441af
title: Implement JWT-based campus context using Clerk session claims
status: todo
priority: high
labels:
  - security
  - performance
  - auth
  - clerk
createdAt: '2026-01-17T18:01:59.907Z'
updatedAt: '2026-01-17T18:04:48.201Z'
timeSpent: 0
---
# Implement JWT-based campus context using Clerk session claims

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate from header-based campus context (x-campus-id) to JWT-based approach using Clerk's session claims. This eliminates DB lookups for campus access validation on every request, improves performance, and follows enterprise security best practices. Campus context will be embedded in the JWT token, which is cryptographically signed and cannot be tampered with by clients.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Add allowedCampuses and activeCampusId to Clerk session claims
- [ ] #2 Create /auth/switch-campus endpoint to issue new session with different active campus
- [ ] #3 Update CampusGuard to read campus from JWT claims instead of header
- [ ] #4 Update @CampusContext decorator to extract from JWT claims
- [ ] #5 Frontend: Remove x-campus-id header injection from API client
- [ ] #6 Frontend: Update campus switching to call /auth/switch-campus endpoint
- [ ] #7 Frontend: Decode campus info from Clerk session for UI display
- [ ] #8 Backward compatibility: Support header fallback during migration (optional)
- [ ] #9 All existing tests pass
- [ ] #10 Performance improvement verified (no DB lookup for campus validation)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Overview

### Current Architecture
```
Request → x-campus-id header → CampusGuard → DB lookup → Validate access → Continue
```

### Target Architecture
```
Request → JWT claims (activeCampusId) → CampusGuard → Trust JWT → Continue (no DB!)
```

### Clerk Session Claims
Clerk allows adding custom claims to JWTs via session claims. These are:
- Cryptographically signed (cannot be tampered)
- Automatically included in every request
- Can be updated by creating a new session

---

## Backend Changes

### Files to Modify

| File | Change |
|------|--------|
| `src/infra/external-services/clerk/clerk-authentication.adapter.ts` | Extract session claims from JWT |
| `src/application/ports/authentication.port.ts` | Add campus claims to AuthenticationResult |
| `src/infra/http/middleware/auth.middleware.ts` | Pass campus claims to request |
| `src/infra/http/guards/campus.guard.ts` | Read campus from JWT instead of header |
| `src/infra/http/decorators/campus.decorator.ts` | Extract from JWT claims |
| `src/infra/http/context/request-context.service.ts` | Store campus claims |
| `src/types/globals.d.ts` | Add campus claims types |

### Files to Create

| File | Purpose |
|------|---------|
| `src/infra/http/controllers/auth.controller.ts` | /auth/switch-campus endpoint |
| `src/application/auth/use-cases/switch-campus.use-case.ts` | Business logic for switching |
| `src/infra/external-services/clerk/clerk-session.service.ts` | Manage Clerk sessions |

---

## Step 1: Define JWT Claims Interface

**File:** `src/types/clerk-claims.ts`

```typescript
export interface CampusAccess {
  id: string;
  name: string;
  role: string;  // Primary role name for this campus
}

export interface ClerkSessionClaims {
  allowedCampuses: CampusAccess[];
  activeCampusId: string | null;
  activeCampusRole: string | null;
}

export interface AuthenticatedUser {
  userId: string;           // Clerk user ID
  sessionId: string;
  claims: ClerkSessionClaims;
}
```

---

## Step 2: Update AuthenticationPort

**File:** `src/application/ports/authentication.port.ts`

```typescript
export interface AuthenticationResult {
  isAuthenticated: boolean;
  userId: string | null;
  sessionId?: string;
  error?: string;
  // NEW: Campus claims from JWT
  claims?: {
    allowedCampuses: CampusAccess[];
    activeCampusId: string | null;
    activeCampusRole: string | null;
  };
}
```

---

## Step 3: Extract Claims in Clerk Adapter

**File:** `src/infra/external-services/clerk/clerk-authentication.adapter.ts`

```typescript
async verifyAuthentication(request: ExpressRequest): Promise<AuthenticationResult> {
  const requestState = await this.clerkClient.authenticateRequest(...);
  const authObject = requestState.toAuth();

  if (!isSignedInSessionAuthObject(authObject)) {
    return { isAuthenticated: false, userId: null };
  }

  // Extract custom session claims
  const sessionClaims = authObject.sessionClaims as ClerkSessionClaims | undefined;

  return {
    isAuthenticated: true,
    userId: authObject.userId,
    sessionId: authObject.sessionId,
    claims: {
      allowedCampuses: sessionClaims?.allowedCampuses ?? [],
      activeCampusId: sessionClaims?.activeCampusId ?? null,
      activeCampusRole: sessionClaims?.activeCampusRole ?? null,
    },
  };
}
```

---

## Step 4: Update AuthMiddleware

**File:** `src/infra/http/middleware/auth.middleware.ts`

```typescript
async use(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const result = await this.authenticationPort.verifyAuthentication(req);

  if (result.isAuthenticated && result.userId) {
    req.clerkId = result.userId;
    req.sessionId = result.sessionId;

    // NEW: Set campus claims on request
    req.campusClaims = result.claims;
    req.campusId = result.claims?.activeCampusId ?? null;
  }

  next();
}
```

---

## Step 5: Update CampusGuard (Simplified)

**File:** `src/infra/http/guards/campus.guard.ts`

```typescript
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const claims = request.campusClaims;

  // No claims = not authenticated or no campus access
  if (!claims || !claims.activeCampusId) {
    if (required) {
      throw new ForbiddenException("No active campus. Please select a campus.");
    }
    return true;
  }

  // Validate activeCampusId is in allowedCampuses (JWT already signed, but extra safety)
  const isAllowed = claims.allowedCampuses.some(c => c.id === claims.activeCampusId);
  if (!isAllowed) {
    throw new ForbiddenException("Invalid campus context");
  }

  // Optional: Check campus is still active (configurable, adds DB call)
  if (requireActive) {
    const campus = await this.campusRepository.findById(claims.activeCampusId);
    if (!campus?.isActive) {
      throw new ForbiddenException("Campus is no longer active");
    }
  }

  // Set validated campus on request
  setCampusOnRequest(request, claims.activeCampusId);
  this.requestContext.setCampusId(claims.activeCampusId);

  return true;
}
```

---

## Step 6: Create Switch Campus Endpoint

**File:** `src/infra/http/controllers/auth.controller.ts`

```typescript
@Controller("auth")
@UseGuards(ClerkAuthGuard)
export class AuthController {
  constructor(
    private readonly switchCampusUseCase: SwitchCampusUseCase,
    private readonly clerkSessionService: ClerkSessionService,
  ) {}

  @Post("switch-campus")
  async switchCampus(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SwitchCampusDto,
  ) {
    // Validate campus is in allowed list (from current JWT)
    const allowed = user.claims.allowedCampuses.find(c => c.id === dto.campusId);
    if (!allowed) {
      throw new ForbiddenException("You do not have access to this campus");
    }

    // Update Clerk session with new active campus
    await this.clerkSessionService.updateSessionClaims(user.sessionId, {
      ...user.claims,
      activeCampusId: dto.campusId,
      activeCampusRole: allowed.role,
    });

    return {
      success: true,
      activeCampusId: dto.campusId,
      activeCampusRole: allowed.role,
    };
  }

  @Get("me")
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      userId: user.userId,
      allowedCampuses: user.claims.allowedCampuses,
      activeCampusId: user.claims.activeCampusId,
      activeCampusRole: user.claims.activeCampusRole,
    };
  }
}
```

---

## Step 7: Clerk Session Service

**File:** `src/infra/external-services/clerk/clerk-session.service.ts`

```typescript
@Injectable()
export class ClerkSessionService {
  constructor(
    @Inject("ClerkClient") private readonly clerkClient: ClerkClient,
    @Inject("USER_REPOSITORY") private readonly userRepository: UserRepository,
  ) {}

  async buildCampusClaims(userId: string): Promise<ClerkSessionClaims> {
    // Fetch user with role assignments
    const user = await this.userRepository.findByClerkUid(userId);
    if (!user) {
      return { allowedCampuses: [], activeCampusId: null, activeCampusRole: null };
    }

    // Build allowed campuses from role assignments
    const campusIds = user.getAccessibleCampusIds();
    const allowedCampuses: CampusAccess[] = [];

    for (const campusId of campusIds) {
      const roles = user.getRolesForCampus(campusId);
      if (roles.length > 0) {
        // Get campus name (may need to fetch)
        const campus = await this.campusRepository.findById(campusId);
        allowedCampuses.push({
          id: campusId,
          name: campus?.name ?? "Unknown",
          role: roles[0].name,  // Primary role
        });
      }
    }

    // Default to first campus
    const defaultCampus = allowedCampuses[0];

    return {
      allowedCampuses,
      activeCampusId: defaultCampus?.id ?? null,
      activeCampusRole: defaultCampus?.role ?? null,
    };
  }

  async updateSessionClaims(sessionId: string, claims: ClerkSessionClaims): Promise<void> {
    // Clerk SDK method to update session claims
    // Note: This invalidates the current JWT, client needs to get new token
    await this.clerkClient.sessions.updateSession(sessionId, {
      publicMetadata: claims,
    });
  }
}
```

---

## Step 8: Clerk Webhook for Login (Set Initial Claims)

**File:** `src/infra/http/webhooks/clerk.webhook.ts`

```typescript
@Post("clerk/webhook")
async handleClerkWebhook(@Body() payload: ClerkWebhookPayload) {
  if (payload.type === "session.created") {
    const { session } = payload.data;

    // Build and set initial campus claims
    const claims = await this.clerkSessionService.buildCampusClaims(session.userId);
    await this.clerkSessionService.updateSessionClaims(session.id, claims);
  }
}
```

---

## Frontend Changes

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/api-client.ts` | Remove x-campus-id header injection |
| `src/components/campus-provider.tsx` | Use Clerk session for campus, call /auth/switch-campus |
| `src/features/campuses/services/campus.service.ts` | Add switchCampus method |

---

## Step 9: Update API Client

**File:** `frontend/src/lib/api-client.ts`

```typescript
// REMOVE this from request interceptor:
// const campusId = getCampusIdForInterceptor();
// if (campusId) {
//   config.headers["X-Campus-Id"] = campusId;
// }

// Campus ID now comes from JWT automatically!
// No header needed - Clerk token contains activeCampusId
```

---

## Step 10: Update Campus Provider

**File:** `frontend/src/components/campus-provider.tsx`

```typescript
import { useAuth, useSession } from "@clerk/nextjs";

export function CampusProvider({ children }) {
  const { session, isLoaded } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  // Read campus info from Clerk session claims
  const campusClaims = session?.publicMetadata as ClerkSessionClaims | undefined;
  const allowedCampuses = campusClaims?.allowedCampuses ?? [];
  const activeCampusId = campusClaims?.activeCampusId ?? null;
  const activeCampusRole = campusClaims?.activeCampusRole ?? null;

  const switchCampus = async (campusId: string) => {
    setIsLoading(true);
    try {
      // Call backend to update session claims
      await campusService.switchCampus(campusId);

      // Refresh Clerk session to get new token with updated claims
      await session?.reload();

      // Clear React Query cache
      queryClient.clear();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CampusContext.Provider value={{
      allowedCampuses,
      activeCampusId,
      activeCampusRole,
      switchCampus,
      isLoading,
    }}>
      {children}
    </CampusContext.Provider>
  );
}
```

---

## Step 11: Add Switch Campus Service

**File:** `frontend/src/features/campuses/services/campus.service.ts`

```typescript
export const campusService = {
  // ... existing methods

  switchCampus(campusId: string): Promise<ApiResponse<SwitchCampusResponse>> {
    return post<SwitchCampusResponse>("/auth/switch-campus", { campusId });
  },
};
```

---

## Migration Strategy

### Phase 1: Backend Support (Week 1)
1. Add session claims extraction to Clerk adapter
2. Create /auth/switch-campus endpoint
3. Update CampusGuard to read from JWT claims
4. Keep header fallback for backward compatibility

### Phase 2: Frontend Migration (Week 2)
1. Update CampusProvider to use Clerk session
2. Implement switchCampus API call
3. Remove x-campus-id header injection
4. Test all flows

### Phase 3: Cleanup (Week 3)
1. Remove header fallback from backend
2. Remove setCampusIdForInterceptor from frontend
3. Update documentation
4. Performance testing

---

## Testing Plan

### Unit Tests
- ClerkAuthenticationAdapter extracts claims correctly
- CampusGuard validates claims
- SwitchCampusUseCase validates allowed campuses

### Integration Tests
- Login flow sets initial campus claims
- Switch campus updates session
- API requests work without header

### E2E Tests
- Full login → select campus → API call flow
- Campus switching with UI refresh

---

## Performance Comparison

| Metric | Header Approach | JWT Approach |
|--------|-----------------|--------------|
| DB queries per request | 1-2 (user + campus) | 0 |
| Validation time | ~50-100ms | ~1ms |
| Scalability | Limited by DB | Unlimited |

---

## Rollback Plan

1. Re-enable header reading in CampusGuard
2. Re-enable header injection in frontend
3. Both can coexist during migration
<!-- SECTION:PLAN:END -->

