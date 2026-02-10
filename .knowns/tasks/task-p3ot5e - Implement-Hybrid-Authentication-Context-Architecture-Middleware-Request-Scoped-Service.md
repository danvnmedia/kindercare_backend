---
id: p3ot5e
title: >-
  Implement Hybrid Authentication Context Architecture (Middleware +
  Request-Scoped Service)
status: done
priority: high
labels:
  - architecture
  - authentication
  - refactoring
  - performance
createdAt: '2026-01-14T08:07:28.681Z'
updatedAt: '2026-01-14T08:27:01.000Z'
timeSpent: 0
---
# Implement Hybrid Authentication Context Architecture (Middleware + Request-Scoped Service)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate from guard-based user fetching to a hybrid middleware + request-scoped service pattern for authentication context management.

## Problem Statement
Currently, the authentication flow has these issues:
1. **User fetched 3-4 times per request** when multiple guards are applied (CampusGuard, RolesGuard, PermissionsGuard each fetch user)
2. **No request-level caching** - each guard independently calls UserRepository
3. **Guard/Interceptor execution order mismatch** - Guards run before UserInterceptor, causing CampusGuard to manually set `request.user`
4. **No typed context abstraction** - Raw data stored directly on Express request object
5. **Cannot pass user context to use cases** - Use cases lack audit context

## Solution
Implement a hybrid pattern:
1. **Authentication Middleware** - Fast Clerk token validation, runs before guards
2. **RequestContext Service** - Request-scoped, lazy-loaded user with caching

## Key Benefits
- Single DB fetch per request (instead of 3-4)
- Clean DI integration with NestJS
- Type-safe context access anywhere (guards, services, use cases)
- Foundation for future caching (Redis)

## References
- @doc/architecture/adr-hybrid-authentication-context-architecture - ADR documenting this decision
- @doc/patterns/guards-pattern - Current guards pattern

## Files Affected

### Create New Files
- `src/infra/http/middleware/auth.middleware.ts` - Authentication middleware
- `src/infra/http/context/request-context.service.ts` - Request-scoped context service
- `src/infra/http/context/request-context.module.ts` - Module for context service
- `src/infra/http/context/request-context.service.spec.ts` - Unit tests

### Modify Existing Files
- `src/infra/http/guards/campus.guard.ts` - Use RequestContext instead of fetching
- `src/infra/http/guards/campus.guard.spec.ts` - Update mocks
- `src/infra/http/guards/roles.guard.ts` - Use RequestContext instead of fetching
- `src/infra/http/guards/roles.guard.spec.ts` - Update mocks
- `src/infra/http/guards/permissions.guard.ts` - Use RequestContext instead of fetching
- `src/infra/http/guards/permissions.guard.spec.ts` - Update mocks
- `src/infra/http/guards/clerk-auth.guard.ts` - Convert to middleware logic
- `src/infra/http/modules/auth.module.ts` - Register middleware and context service
- `src/infra/http/http.module.ts` - Apply middleware globally

### Delete Files
- `src/infra/http/interceptors/user.interceptor.ts` - No longer needed
- `src/infra/http/interceptors/user.interceptor.spec.ts` - No longer needed
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AuthMiddleware validates Clerk token and sets clerkId/sessionId on request before guards run
- [ ] #2 RequestContext service is request-scoped and lazily loads user data on first getUser() call
- [ ] #3 RequestContext caches user data within request lifecycle (no duplicate DB fetches)
- [ ] #4 CampusGuard uses RequestContext.getUser() instead of direct repository fetch
- [ ] #5 RolesGuard uses RequestContext.getUser() instead of direct repository fetch
- [ ] #6 PermissionsGuard uses RequestContext.getUser() instead of direct repository fetch
- [ ] #7 UserInterceptor is removed (replaced by RequestContext lazy loading)
- [ ] #8 ClerkAuthGuard is replaced by AuthMiddleware for token validation
- [ ] #9 @CurrentUser() and @UserDecorator() decorators use RequestContext
- [ ] #10 RequestContext can be injected into controllers and use cases
- [ ] #11 Unit tests for RequestContext service cover: lazy loading, caching, error handling
- [ ] #12 All existing guard tests pass with updated RequestContext mocking
- [ ] #13 No breaking changes to public API endpoints
- [ ] #14 Integration tests verify single DB fetch per request (performance validation)
- [ ] #15 RequestContext provides getCampusId() method synced with CampusGuard validation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
# Implementation Plan: Hybrid Authentication Context Architecture

## Phase 1: Create RequestContext Service (Foundation)

### 1.1 Create RequestContext Interface and Service
**File**: src/infra/http/context/request-context.service.ts

Key implementation:
- Injectable with Scope.REQUEST
- Inject REQUEST token and USER_REPOSITORY
- Properties: clerkId, sessionId, campusId, user, userLoaded (cache flag)
- Constructor initializes from request if already set by middleware
- getUser() implements lazy loading with caching:
  - If userLoaded is true, return cached user
  - If no clerkId, mark loaded and return null
  - Otherwise fetch from repository, cache, and return
- Setter methods for clerkId, sessionId, campusId
- isAuthenticated() returns true if clerkId is set

### 1.2 Create RequestContext Module
**File**: src/infra/http/context/request-context.module.ts

- Export RequestContext as provider
- Import dependencies for USER_REPOSITORY
- Configure as request-scoped module

### 1.3 Create Unit Tests
**File**: src/infra/http/context/request-context.service.spec.ts

Test cases:
- Returns null clerkId when not authenticated
- Returns clerkId after setClerkId() called
- getUser() fetches from repository on first call
- getUser() returns cached user on subsequent calls (verify repository called once)
- getUser() returns null when no clerkId
- getCampusId() returns validated campus ID
- isAuthenticated() returns true when clerkId is set

---

## Phase 2: Create Authentication Middleware

### 2.1 Create AuthMiddleware
**File**: src/infra/http/middleware/auth.middleware.ts

Key implementation:
- Injectable NestMiddleware
- Inject AUTHENTICATION_PORT
- use() method:
  - Try to verify authentication via authenticationPort.verifyAuthentication(req)
  - If successful, set req.clerkId and req.sessionId
  - Catch errors silently (let guards handle authorization)
  - Always call next()

### 2.2 Register Middleware Globally
**File**: src/infra/http/http.module.ts

- Implement NestModule interface
- configure() method applies AuthMiddleware to all routes

### 2.3 Create Middleware Tests
**File**: src/infra/http/middleware/auth.middleware.spec.ts

Test cases:
- Sets clerkId and sessionId on valid token
- Continues without error on invalid token
- Continues without error on missing token
- Calls next() in all cases

---

## Phase 3: Migrate Guards to Use RequestContext

### 3.1 Update ClerkAuthGuard
**File**: src/infra/http/guards/clerk-auth.guard.ts

Changes:
- Remove Clerk token verification (moved to middleware)
- Check if request.clerkId exists (set by middleware)
- Throw UnauthorizedException if clerkId missing and route not public
- Simplify to pure authorization check

### 3.2 Update CampusGuard
**File**: src/infra/http/guards/campus.guard.ts

Changes:
- Inject RequestContext instead of UserRepository
- Replace userRepository.findByClerkUid(clerkId) with requestContext.getUser()
- Remove manual request.user = fullUser (RequestContext handles caching)
- Use requestContext.setCampusId() to store validated campus

### 3.3 Update RolesGuard
**File**: src/infra/http/guards/roles.guard.ts

Changes:
- Inject RequestContext instead of UserRepository
- Replace user fetching logic with requestContext.getUser()
- Get campus from requestContext.getCampusId()

### 3.4 Update PermissionsGuard
**File**: src/infra/http/guards/permissions.guard.ts

Changes:
- Inject RequestContext instead of UserRepository
- Replace userRepository.findById(user.id) with requestContext.getUser()
- Get campus from requestContext.getCampusId()

### 3.5 Update All Guard Tests
Files:
- src/infra/http/guards/clerk-auth.guard.spec.ts
- src/infra/http/guards/campus.guard.spec.ts
- src/infra/http/guards/roles.guard.spec.ts
- src/infra/http/guards/permissions.guard.spec.ts

Changes:
- Mock RequestContext instead of UserRepository
- Verify RequestContext.getUser() called (not repository)
- Test caching behavior (RequestContext returns same user on multiple calls)

---

## Phase 4: Update Decorators

### 4.1 Update @CurrentUser() Decorator
**File**: src/infra/http/decorators/current-user.decorator.ts

Option A (Simple - recommended for initial implementation):
- Keep using createParamDecorator
- Read user from request.user (synced by RequestContext)

Option B (Direct injection - future enhancement):
- Create factory decorator that injects RequestContext
- Transform to get user

### 4.2 Update @CampusContext() Decorator
**File**: src/infra/http/decorators/campus.decorator.ts

Changes:
- Read campusId from request.campusId (set by RequestContext)
- No changes needed if guards already sync to request object

---

## Phase 5: Remove UserInterceptor

### 5.1 Delete UserInterceptor
Files to delete:
- src/infra/http/interceptors/user.interceptor.ts
- src/infra/http/interceptors/user.interceptor.spec.ts

### 5.2 Remove UserInterceptor from Controllers
Files to update:
- src/infra/http/controllers/auth/auth.controller.ts - Remove @UseInterceptors(UserInterceptor)
- src/infra/http/controllers/file-management/file.controller.ts - Remove @UseInterceptors(UserInterceptor)
- Any other controllers using UserInterceptor

### 5.3 Remove UserInterceptor from Module Exports
**File**: src/infra/http/modules/auth.module.ts

- Remove UserInterceptor from providers
- Remove UserInterceptor from exports

---

## Phase 6: Sync RequestContext with Request Object

### 6.1 Update RequestContext to Sync with Request
To maintain backward compatibility with decorators that read from request.user:

In getUser():
- After fetching user, also set this.request.user = this.user

In setCampusId():
- Also set this.request.campusId = campusId

This ensures decorators like @CurrentUser() and @CampusContext() continue to work.

---

## Phase 7: Module Configuration

### 7.1 Update HttpModule
**File**: src/infra/http/http.module.ts

- Import RequestContextModule
- Implement NestModule with configure() for AuthMiddleware

### 7.2 Update AuthModule
**File**: src/infra/http/modules/auth.module.ts

- Remove UserInterceptor
- Import RequestContextModule
- Keep other providers (ClerkModule, etc.)

### 7.3 Update UserManagementModule
**File**: src/infra/http/modules/user-management.module.ts

- Import RequestContextModule
- Remove direct UserRepository injection in guards (use RequestContext instead)

---

## Phase 8: Integration Testing

### 8.1 Create Integration Test for Single DB Fetch
**File**: src/infra/http/context/request-context.integration.spec.ts

Test cases:
- Request with CampusGuard + RolesGuard + PermissionsGuard only fetches user once
- Verify UserRepository.findByClerkUid called exactly once per request
- Verify performance improvement (measure response time before/after)

### 8.2 E2E Test Updates
Verify existing E2E tests pass without modification (backward compatible).

---

## Phase 9: Documentation

### 9.1 Update Guards Pattern Doc
**File**: @doc/patterns/guards-pattern (via knowns doc edit)

Add section on RequestContext usage in guards.

### 9.2 Update Module and Request Flow Doc
**File**: @doc/architecture/module-and-request-flow (via knowns doc edit)

Update execution flow diagram to show:
1. Middleware (AuthMiddleware)
2. Guards (use RequestContext)
3. Route Handler

---

## Execution Order Summary

### Current Flow (Before)
Request
  -> ClerkAuthGuard (verifies token, sets clerkId)
  -> CampusGuard (fetches user from DB #1, sets request.user)
  -> RolesGuard (fetches user from DB #2)
  -> PermissionsGuard (fetches user from DB #3)
  -> UserInterceptor (fetches user from DB #4 if not set)
  -> Controller

### New Flow (After)
Request
  -> AuthMiddleware (verifies token, sets clerkId)
  -> ClerkAuthGuard (checks clerkId exists)
  -> CampusGuard (calls RequestContext.getUser() - DB fetch #1)
  -> RolesGuard (calls RequestContext.getUser() - cached)
  -> PermissionsGuard (calls RequestContext.getUser() - cached)
  -> Controller (uses @CurrentUser() - cached)

---

## Risk Mitigation

1. **Request-scoped service overhead**: Minimal - only creates service instance, lazy loading prevents unnecessary DB calls
2. **Breaking changes**: Mitigated by syncing RequestContext to request object for decorator compatibility
3. **Test failures**: Comprehensive test updates included in each phase

---

## Rollback Plan

If issues arise:
1. Revert middleware changes (guards can handle auth again)
2. Keep RequestContext but make user loading eager in guards
3. Worst case: Revert to previous guard-based approach

---

## Dependencies

- NestJS @nestjs/core for REQUEST injection token
- Existing ClerkModule for AuthenticationPort
- Existing PrismaModule for UserRepository

No new external dependencies required.
<!-- SECTION:PLAN:END -->

