---
id: cwlp29
title: Filter /campuses endpoint by user role assignments
status: done
priority: medium
labels:
  - backend
  - api
  - authorization
  - campus
createdAt: '2026-01-16T03:29:41.923Z'
updatedAt: '2026-01-16T04:52:51.754Z'
timeSpent: 4652
assignee: '@me'
---
# Filter /campuses endpoint by user role assignments

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently GET /campuses returns all campuses regardless of user access. It should only return campuses where the authenticated user has at least one role assignment. This follows the existing campus-scoped access control pattern used throughout the codebase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /campuses returns only campuses where the user has at least one role assignment
- [x] #2 Users with a global role (campusId: null) receive all active campuses
- [x] #3 Users with no role assignments receive an empty array []
- [x] #4 Existing pagination and filtering (name, address, isActive) still work correctly
- [x] #5 Unit tests cover all scenarios: campus-scoped roles, global roles, no roles
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Extend Use Case (Clean Architecture Pattern)

1. **Modify `GetAllCampusesUseCase`** (`src/application/campus/use-cases/get-all-campuses.use-case.ts`)
   - Add optional `accessibleCampusIds: string[] | null` parameter to execute method
   - When `accessibleCampusIds = null` → user has global access, return all
   - When `accessibleCampusIds = []` → user has no access, return empty result
   - When `accessibleCampusIds = [id1, id2, ...]` → add filter: `id: { in: accessibleCampusIds }`
   - Merge with existing StandardRequest filters

### Phase 2: Update Controller

2. **Modify `CampusController.findAll()`** (`src/infra/http/controllers/campus.controller.ts`)
   - Inject `RequestContext` service
   - Get authenticated user via `requestContext.getUserOrFail()`
   - Extract accessible campus IDs from user's role assignments:
     ```typescript
     const accessibleCampusIds = user.hasGlobalRole()
       ? null  // Global access
       : user.getAccessibleCampusIds();  // Or empty array if none
     ```
   - Pass `accessibleCampusIds` to use case

### Phase 3: Add User Entity Helper Method

3. **Add helper method to User entity** (`src/domain/user-management/user.entity.ts`)
   - Add `hasGlobalRole(): boolean` - checks if any role assignment has `campusId: null`
   - Add `getAccessibleCampusIds(): string[]` - returns unique campusIds from role assignments (excluding null)

### Phase 4: Testing

4. **Unit Tests** (`src/application/campus/use-cases/__tests__/get-all-campuses.use-case.spec.ts`)
   - Test: User with campus-scoped roles gets filtered results
   - Test: User with global role gets all campuses
   - Test: User with no roles gets empty array
   - Test: Pagination still works with filtering
   - Test: Existing filters (name, isActive) combine correctly with access filter

### Key Files to Modify
- `src/application/campus/use-cases/get-all-campuses.use-case.ts`
- `src/infra/http/controllers/campus.controller.ts`
- `src/domain/user-management/user.entity.ts`
- Tests: `get-all-campuses.use-case.spec.ts`

### Architecture Notes
- Follows existing clean architecture pattern used in Staff/Class/Student controllers
- Uses RequestContext for lazy user loading (already established pattern)
- Keeps filtering logic in use case layer per single responsibility
- User entity methods enable reuse across other endpoints if needed
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Summary

### Changes Made:

1. **User Entity** ()
   - Added  - checks if any role assignment has campusId = null
   - Added  - returns unique campusIds from role assignments

2. **GetAllCampusesUseCase** ()
   - Changed signature to accept  with 
   - Three cases: null = global access, [] = no access (empty result), [...ids] = filter by IDs
   - Uses Prisma 'in' operator to filter by accessible campus IDs

3. **CampusController** ()
   - Injected RequestContext service
   - findAll() now extracts user via requestContext.getUserOrFail()
   - Determines access level using hasGlobalRole() and getAccessibleCampusIds()

4. **Unit Tests** ()
   - 15 tests covering global access, no access, campus-scoped access, and edge cases

### Architecture Notes:
- Follows existing clean architecture patterns (domain -> application -> infra)
- Uses existing RequestContext lazy-loading pattern
- User entity helper methods enable reuse across other endpoints
<!-- SECTION:NOTES:END -->

