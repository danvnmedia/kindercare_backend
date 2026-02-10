---
id: ha1q3d
title: Audit and fix cross-campus access control gaps
status: done
priority: high
labels:
  - security
  - auth
  - campus
createdAt: '2026-01-15T04:04:01.110Z'
updatedAt: '2026-01-15T05:22:47.667Z'
timeSpent: 3981
assignee: '@me'
---
# Audit and fix cross-campus access control gaps

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Security Audit: Cross-Campus Access Control Gaps

### Problem Statement
Entity creation endpoints accept `campusId` in request body but don't validate that the authenticated user has access to that campus. This allows staff from Campus A to potentially create entities in Campus B.

### Analysis Results

**CRITICAL: 22 endpoints missing ClerkAuthGuard (no authentication):**
- campus.controller.ts: ALL 5 endpoints (CREATE/READ/UPDATE/DELETE campuses)
- staff.controller.ts: POST /staff
- staff-type.controller.ts: ALL 5 endpoints
- class.controller.ts: ALL 11 endpoints
- reference-data.controller.ts: 5 POST/PATCH/DELETE endpoints
- post-category.controller.ts: 4 endpoints (create, update, delete, reorder)

**MEDIUM: 15+ endpoints with ClerkAuthGuard but missing @RequireCampusAccess:**
- student.controller.ts: POST create, PATCH/:id, DELETE/:id, guardian operations
- guardian.controller.ts: GET/:id, PATCH/:id, DELETE/:id, restore
- comment.controller.ts: ALL 5 endpoints
- danger-guardian.controller.ts: DELETE

**DTOs accepting campusId in body without validation:**
- CreateStudentRequest, CreateStaffRequest, CreateGuardianRequest
- CreateClassRequest, CreateStaffTypeRequest
- CreatePostCategoryRequest, CreateRoleRequest
- CreateGradeLevelRequest, CreateSchoolYearRequest

### Root Cause
1. POST endpoints don't apply @RequireCampusAccess() decorator
2. Body campusId is only validated for UUID format, NOT user access
3. Use-cases trust that guards have validated access (but guards aren't applied)

### Super Admin Status
✅ Already bypasses via `isGlobalAdmin()` in CampusGuard (`allowGlobalAdmin` defaults to `true`)
- Checks `isSystemRole === true` on globally-assigned roles
- No changes needed for Super Admin bypass

### Related Files
- src/infra/http/guards/campus.guard.ts (CampusGuard implementation)
- src/infra/http/context/campus-context.ts (hasCampusAccess, isGlobalAdmin)
- src/infra/http/decorators/require-campus-access.decorator.ts
- src/infra/http/controllers/ (all controllers)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All 7 controllers missing ClerkAuthGuard have controller-level @UseGuards(ClerkAuthGuard) added
- [x] #2 All 8 POST creation endpoints override body campusId with @CampusContext() validated campusId
- [x] #3 All CRUD endpoints that need campus scoping have @RequireCampusAccess() decorator
- [x] #4 Super Admin/Global Admin can still access and create entities in any campus
- [x] #5 Integration tests verify cross-campus creation prevention for Student, Staff, Guardian
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Fix CRITICAL - Missing Authentication (Priority: Immediate)
Add @UseGuards(ClerkAuthGuard) to controllers missing authentication:

1.1. **campus.controller.ts** - Add controller-level @UseGuards(ClerkAuthGuard)
1.2. **staff.controller.ts** - Add controller-level @UseGuards(ClerkAuthGuard)
1.3. **staff-type.controller.ts** - Add controller-level @UseGuards(ClerkAuthGuard)
1.4. **class.controller.ts** - Add controller-level @UseGuards(ClerkAuthGuard)
1.5. **reference-data.controller.ts** - Add controller-level @UseGuards(ClerkAuthGuard)
1.6. **post-category.controller.ts** - Add controller-level @UseGuards(ClerkAuthGuard)
1.7. **attendance.controller.ts** - Add controller-level @UseGuards(ClerkAuthGuard)

### Phase 2: Fix MEDIUM - Missing Campus Validation for Creation Endpoints
For each creation endpoint that accepts campusId in body:

2.1. Add @RequireCampusAccess() decorator
2.2. Add @CampusContext() parameter to get validated campusId
2.3. Override dto.campusId with validated campusId from context

**Pattern to apply:**
```typescript
@Post()
@RequireCampusAccess()
async create(
  @CampusContext() campusId: string,
  @Body() dto: CreateEntityRequest
) {
  return await this.useCase.execute({
    ...dto,
    campusId, // Use context, NOT dto.campusId
  });
}
```

**Endpoints to fix:**
- POST /students (student.controller.ts)
- POST /staff (staff.controller.ts)
- POST /guardians (guardian.controller.ts)
- POST /classes (class.controller.ts)
- POST /staff-types (staff-type.controller.ts)
- POST /post-categories (post-category.controller.ts)
- POST /reference-data/grade-levels
- POST /reference-data/school-years

### Phase 3: Fix Missing Campus Validation for CRUD Endpoints
Add @RequireCampusAccess() to endpoints that need campus scoping:

3.1. student.controller.ts: PATCH/:id, DELETE/:id, guardian operations
3.2. guardian.controller.ts: GET/:id, PATCH/:id, DELETE/:id, restore
3.3. comment.controller.ts: ALL endpoints
3.4. class.controller.ts: ALL CRUD and relationship endpoints
3.5. reference-data.controller.ts: ALL endpoints
3.6. attendance.controller.ts: GET endpoints
3.7. danger-guardian.controller.ts: DELETE

### Phase 4: Verification
4.1. Verify Super Admin bypass works (isGlobalAdmin check in CampusGuard)
4.2. Run existing tests to ensure no regressions
4.3. Add integration tests for cross-campus prevention scenarios

### Phase 5: Testing
Add tests for:
- Cross-campus student creation prevention
- Cross-campus staff creation prevention
- Super Admin can create in any campus
- Campus-scoped user cannot create in other campus

### Notes
- Do NOT change use-case layer (trusts controller-validated campusId)
- Do NOT change DTO validation (UUID format is sufficient)
- Focus on controller layer: guards + context override
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete (2026-01-15)

### Changes Made:

**Phase 1 - Added ClerkAuthGuard to 7 controllers:**
- campus.controller.ts
- staff.controller.ts  
- staff-type.controller.ts
- class.controller.ts
- reference-data.controller.ts
- post-category.controller.ts
- attendance.controller.ts

**Phase 2 - Added @RequireCampusAccess + campusId override on POST endpoints:**
All creation endpoints now:
1. Use @RequireCampusAccess() decorator
2. Extract validated campusId from @CampusContext()
3. Override any body campusId with the validated context campusId

**Phase 3 - Added @RequireCampusAccess to CRUD endpoints:**
- PATCH, DELETE, GET endpoints across all controllers
- Updated 14 use cases to accept optional campusId for validation

**Phase 4 - Super Admin Bypass Verified:**
- isGlobalAdmin() checks isSystemRole === true
- Guard allows Super Admin access to any campus via allowGlobalAdmin: true

### Test Coverage:
- All 385 tests pass
- cross-campus-prevention.integration.spec.ts: Use-case level tests
- campus.guard.spec.ts: Guard level tests including Global Admin bypass

### Key Files Modified:
- 7 controllers updated with guards/decorators
- 14 use cases updated with optional campusId validation
- TypeScript compilation passes
<!-- SECTION:NOTES:END -->

