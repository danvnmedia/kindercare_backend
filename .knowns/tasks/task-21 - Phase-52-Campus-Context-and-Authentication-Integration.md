---
id: '21'
title: 'Phase 5.2: Campus Context and Authentication Integration'
status: todo
priority: high
labels:
  - auth
  - campus-context
  - guard
  - decorator
  - phase-5
createdAt: '2026-01-06T04:36:09.734Z'
updatedAt: '2026-01-06T04:38:43.305Z'
timeSpent: 0
---
# Phase 5.2: Campus Context and Authentication Integration

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create the campus context mechanism that allows requests to be scoped to a specific campus. This is critical for all campus-scoped operations.

Depends on @task-9 (Campus module), @task-20 (User roles campus scoping).
See @doc/migrations/multi-campus-migration for context.

## Requirements

### Campus Context Resolution
The system needs to determine which campus a request is operating in. Options:

1. **Header-based**: X-Campus-Id header
2. **Path-based**: /campuses/{campusId}/students
3. **Auth token claim**: Campus ID in JWT
4. **User default**: User's default/primary campus

Recommended: Header-based with fallback to user's default campus.

## Implementation

### Decorator
**File**: src/infra/http/decorators/campus.decorator.ts


### Guard
**File**: src/infra/http/guards/campus.guard.ts
- Extract campusId from request (header/path/token)
- Verify campus exists and is active
- Verify user has at least one role in that campus (or is global admin)
- Attach campus to request for downstream use

### Interceptor (optional)
- Could add campus context to response headers
- Could log campus context for auditing

### Request Context
**File**: src/infra/http/context/request-context.ts (or similar)
- Store current campusId in async local storage or request object
- Make accessible throughout request lifecycle

## Controller Integration

All campus-scoped controllers should:
1. Use @RequireCampusAccess() guard
2. Use @CampusContext() to extract campusId
3. Pass campusId to use cases

Example:


## Error Handling
- 400 Bad Request: Missing campus context
- 403 Forbidden: User has no access to campus
- 404 Not Found: Campus does not exist

## Testing Considerations
- Test with valid campus access
- Test without campus header
- Test with invalid campus
- Test with campus user doesn't have access to
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Campus decorator created (@CampusContext)
- [ ] #2 Campus guard created (@RequireCampusAccess)
- [ ] #3 Campus extraction from header implemented
- [ ] #4 Fallback to user's default campus (if configured)
- [ ] #5 Campus existence validation in guard
- [ ] #6 User campus access verification in guard
- [ ] #7 Campus ID available throughout request lifecycle
- [ ] #8 Clear error messages for missing/invalid campus
- [ ] #9 All campus-scoped controllers updated to use decorators
- [ ] #10 E2E tests for campus context scenarios
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create campus decorator: src/infra/http/decorators/campus.decorator.ts
   - @CampusContext() - Parameter decorator to extract campusId
   - Reads from X-Campus-Id header
   - Falls back to user's default campus if configured

2. Create campus guard: src/infra/http/guards/campus.guard.ts
   - Extract campusId from request header
   - Validate campus exists and is active
   - Verify user has at least one role in that campus
   - Exception for global admins (campus_id = null roles)
   - Attach campusId to request object

3. Create @RequireCampusAccess() decorator
   - Combines with UseGuards(CampusGuard)
   - Makes it easy to apply to controllers/routes

4. Create request context helper: src/infra/http/context/campus-context.ts
   - Helper to get/set current campus in request
   - Consider AsyncLocalStorage for deep access

5. Update existing guards: src/infra/http/guards/roles.guard.ts
   - Check roles within current campus context
   - Global roles (campus_id = null) should pass for any campus

6. Create interceptor (optional): src/infra/http/interceptors/campus.interceptor.ts
   - Add campus context to response headers
   - Log campus context for auditing

7. Update all campus-scoped controllers:
   - Add @RequireCampusAccess() at controller level
   - Use @CampusContext() to extract campusId
   - Pass campusId to use cases

8. Add E2E tests:
   - Request with valid X-Campus-Id header
   - Request without header (should fail)
   - Request with invalid campus ID
   - Request to campus user has no access to
   - Global admin accessing any campus
<!-- SECTION:PLAN:END -->

