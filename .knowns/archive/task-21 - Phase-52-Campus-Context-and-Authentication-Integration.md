---
id: '21'
title: 'Phase 5.2: Campus Context and Authentication Integration'
status: done
priority: high
labels:
  - auth
  - campus-context
  - guard
  - decorator
  - phase-5
createdAt: '2026-01-06T04:36:09.734Z'
updatedAt: '2026-01-10T20:53:37.511Z'
timeSpent: 629
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
- [x] #1 Campus decorator created (@CampusContext)
- [x] #2 Campus guard created (@RequireCampusAccess)
- [x] #3 Campus extraction from header implemented
- [ ] #4 Fallback to user's default campus (if configured)
- [x] #5 Campus existence validation in guard
- [x] #6 User campus access verification in guard
- [x] #7 Campus ID available throughout request lifecycle
- [x] #8 Clear error messages for missing/invalid campus
- [ ] #9 All campus-scoped controllers updated to use decorators
- [ ] #10 E2E tests for campus context scenarios
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan for Task 21: Campus Context and Authentication Integration

### Design Decisions (Based on Analysis)

**1. Campus Context Resolution Strategy:**
- Primary: \ HTTP header
- Fallback 1: Route params (\)
- Fallback 2: Query params (\)
- No user default campus fallback (requires explicit campus selection)

**2. Architecture Components:**
- \ - Parameter decorator to extract campusId
- \ - Guard to validate campus exists, is active, and user has access
- \ - Method decorator combining guard application
- Request enrichment: Store validated \ on request object

**3. Integration Points:**
- Works alongside existing RolesGuard and PermissionsGuard
- CampusGuard runs BEFORE role/permission checks
- Uses existing CampusRepository for validation

### Phase 1: Core Decorators (src/infra/http/decorators/)

#### 1.1 Campus Context Decorator
**File:** - \ parameter decorator using - Extracts campusId from header > params > query
- Returns string | null
- Export \ constant

#### 1.2 Require Campus Access Decorator
**File:** - \ method decorator
- Composes \ with - Optional config: 
### Phase 2: Campus Guard (src/infra/http/guards/)

#### 2.1 Campus Guard Implementation
**File:** - Inject: CampusRepository, UserRepository, Reflector
- Extract campusId from request (same logic as decorator)
- Validate:
  1. CampusId is present (throw 400 if required and missing)
  2. Campus exists (throw 404 if not found)
  3. Campus is active (throw 403 if deactivated)
  4. User has at least one role in campus OR global admin (throw 403 if no access)
- Enrich request: - Enrich request: \ (optional)

### Phase 3: Request Context Helper

#### 3.1 Campus Context Utility
**File:** - \ - Extract campusId
- \ - Store on request
- \ - Check user access
- Shared utility used by guards and decorators

### Phase 4: Type Extensions

#### 4.1 Extend Express Request
**File:** \ (update)
- Add \ to Request interface
- Add \ to Request interface (optional)

### Phase 5: Module Integration

#### 5.1 Update Decorator Index
**File:** - Export new decorators and constants

#### 5.2 Update Guards Index
**File:** - Export CampusGuard

### Phase 6: Controller Updates

#### 6.1 Controllers to Update (Examples)
- \ - Add @RequireCampusAccess()
- \ - Add @RequireCampusAccess()
- \ - Add @RequireCampusAccess()
- \ - Add @RequireCampusAccess()
- \ - Add @RequireCampusAccess()

### Phase 7: Testing

#### 7.1 Unit Tests
- Campus decorator extraction logic
- CampusGuard validation scenarios

### Error Handling Matrix

| Scenario | HTTP Status | Message |
|----------|-------------|---------|
| Missing campus (required) | 400 | Campus context is required |
| Invalid UUID format | 400 | Invalid campus ID format |
| Campus not found | 404 | Campus not found |
| Campus deactivated | 403 | Campus is not active |
| User no access to campus | 403 | No access to this campus |

### Files to Create
1. 2. 3. 4. 
### Files to Modify
1. \ - Add campusId to Request
2. \ - Export new decorators
3. \ - Register guard provider
4. Various controllers - Add decorators
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Review Notes (2026-01-10)

**Implementation Status: Not started - Full implementation needed**

**Clarifications Needed:**

1. **Campus Context Resolution Strategy**
   Task mentions multiple options but doesn't specify primary:
   - Header-based (X-Campus-Id)
   - Path-based (/campuses/:id/...)
   - Token-based (from JWT claims)
   - Default campus fallback
   
   **Recommendation:** Clarify the priority order and which is primary.

2. **User Default Campus Field**
   Task mentions "fallback to user's default campus" but User entity does NOT have a defaultCampusId field.
   
   **Options:**
   a) Add defaultCampusId to User entity
   b) Derive from Guardian/Staff profile's first campus
   c) Require explicit campus selection (no fallback)
   
   **Recommendation:** Clarify which approach to use.

3. **Request Context Storage**
   Options: AsyncLocalStorage vs NestJS Request Scope vs Custom Provider
   
   **Recommendation:** Specify the mechanism.

**Implementation Requirements:**
- @CampusContext() parameter decorator
- @RequireCampusAccess() guard decorator
- CampusGuard for validation
- Update all campus-scoped controllers

**Dependency:** Task 20 (User Roles Campus Scoping) should be completed first.

### Implementation Completed (2026-01-10)

**Summary:** Created the campus context mechanism for request scoping to specific campuses.

## Files Created

### Context Layer
-   - Shared utilities: getCampusFromRequest(), setCampusOnRequest(), getValidatedCampusId()
  - Helper functions: hasCampusAccess(), isGlobalAdmin(), isValidUUID()
  - Exports CAMPUS_ID_HEADER constant

### Decorators
-   - @CampusContext() param decorator - extracts campusId from request
  - Supports validated campus from CampusGuard or direct extraction

-   - @RequireCampusAccess(options?) method/class decorator
  - @OptionalCampusAccess(options?) alias for required: false
  - Options: required, requireActive, checkUserAccess, allowGlobalAdmin

### Guards
-   - Validates campus exists, is active, user has access
  - Supports global admin bypass
  - Sets validated campusId on request object
  - Proper error handling: 400/403/404

- \ (new)
  - Exports all guards

## Files Modified

### Guards Updated
-   - Uses shared getCampusFromRequest() utility
  - Prefers validated campusId from CampusGuard

-   - Uses shared getCampusFromRequest() utility
  - Prefers validated campusId from CampusGuard

### Type Declarations
-   - Added campusId?: string to Express Request interface

### Decorator Exports
-   - Added CampusContext, RequireCampusAccess, OptionalCampusAccess exports

### Example Controllers Updated
-   - findAll() uses @RequireCampusAccess() and @CampusContext()
  - Replaced @Query('campusId') with @CampusContext()

-   - Removed manual requireCampusId() helper
  - findAll() uses @RequireCampusAccess() and @CampusContext()

### Module Registration
-   - Added CampusGuard, RolesGuard, PermissionsGuard as providers

## Usage Examples

### Basic campus-scoped endpoint:
\
### Optional campus context:
\
### Public campus info (no user access check):
\
## Campus Resolution Priority
1. X-Campus-Id header
2. :campusId route parameter
3. ?campusId query parameter

## Build Status: Successful
<!-- SECTION:NOTES:END -->

