---
id: jg8iyc
title: >-
  Update all campus-scoped controllers to use @RequireCampusAccess and
  @CampusContext decorators
status: done
priority: medium
labels:
  - refactor
  - campus-context
  - controllers
  - phase-5
createdAt: '2026-01-10T21:00:16.417Z'
updatedAt: '2026-01-10T21:11:39.210Z'
timeSpent: 430
---
# Update all campus-scoped controllers to use @RequireCampusAccess and @CampusContext decorators

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate all remaining campus-scoped controllers to use the new campus context decorators created in task 21.

## Background
Task 21 created the campus context mechanism with @RequireCampusAccess() guard decorator and @CampusContext() param decorator. Only student.controller.ts and guardian.controller.ts were updated as examples. This task completes the migration for all remaining controllers.

## Controllers to Update (9 controllers, 19 methods)

### 1. staff.controller.ts (6 methods)
- findAll() - @Headers('x-campus-id') -> @CampusContext()
- findById() - @Headers('x-campus-id') -> @CampusContext()
- update() - @Headers('x-campus-id') -> @CampusContext()
- archive() - @Headers('x-campus-id') -> @CampusContext()
- restore() - @Headers('x-campus-id') -> @CampusContext()
- create() - campusId in body (keep as-is, body takes precedence)
- Remove requireCampusId() helper method

### 2. reference-data.controller.ts (3 methods)
- getGradeLevels() - @Query('campusId') -> @CampusContext()
- getSchoolYears() - @Query('campusId') -> @CampusContext()
- getSubjects() - @Query('campusId') -> @CampusContext()

### 3. post.controller.ts (2 methods)
- getPendingApprovals() - @Query('campusId') -> @CampusContext()
- getPinnedPosts() - @Query('campusId') -> @CampusContext()

### 4. campus-setting.controller.ts (2 methods)
- getCampusSettings() - @Query('campusId') -> @CampusContext()
- updateCampusSettings() - @Query('campusId') -> @CampusContext()

### 5. post-category.controller.ts (2 methods)
- findAll() - @Query('campusId') -> @CampusContext()
- create() - campusId in body (keep as-is)

### 6. class.controller.ts (1 method)
- findAll() - @Query('campusId') -> @CampusContext()

### 7. file.controller.ts (1 method)
- initiateUpload() - campusId in body (keep as-is, but add @RequireCampusAccess for validation)

### 8. staff-type.controller.ts (1 method)
- create() - campusId in body (keep as-is)

### 9. danger-staff.controller.ts (1 method)
- hardDelete() - @Headers('x-campus-id') -> @CampusContext()
- Remove requireCampusId() helper method

## Migration Pattern

For each method:
1. Add @RequireCampusAccess() decorator
2. Replace @Query('campusId')/@Headers('x-campus-id') with @CampusContext()
3. Update @ApiQuery to @ApiHeader where applicable
4. Remove manual validation helper methods
5. Ensure module imports CampusModule and registers guards

## Notes
- Methods with campusId in request body should keep body extraction but can add @RequireCampusAccess() for access validation
- Standardize on x-campus-id header as primary extraction source
- Update Swagger docs to reflect header-based approach

Depends on @task-21
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 staff.controller.ts updated (6 methods)
- [x] #2 reference-data.controller.ts updated (3 methods)
- [x] #3 post.controller.ts updated (2 methods)
- [x] #4 campus-setting.controller.ts updated (2 methods)
- [x] #5 post-category.controller.ts updated (2 methods)
- [x] #6 class.controller.ts updated (1 method)
- [x] #7 file.controller.ts updated (1 method)
- [x] #8 staff-type.controller.ts updated (1 method)
- [x] #9 danger-staff.controller.ts updated (1 method)
- [x] #10 All manual requireCampusId() helpers removed
- [x] #11 Swagger documentation updated to reflect x-campus-id header
- [x] #12 Build passes with no errors
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Verified Implementation Plan

### Analysis Summary
After thorough code analysis, the task description is accurate. Here's the detailed breakdown:

### Controllers to Update (15 methods needing @CampusContext conversion)

**Pattern for each method:**
1. Add `@RequireCampusAccess()` decorator
2. Replace `@Query('campusId')` or `@Headers('x-campus-id')` with `@CampusContext()`
3. Replace `@ApiQuery` with `@ApiHeader` using `CAMPUS_ID_HEADER` constant
4. Remove any manual `requireCampusId()` helper methods
5. Update imports to include decorators from `../../decorators`

### Phase 1: Staff Controllers (High Impact)
**1. staff.controller.ts** - 5 methods with headers + 1 body method
- Remove `requireCampusId()` helper (lines 46-65)
- Remove local CAMPUS_ID_HEADER constant (line 32)
- Import: `CampusContext, RequireCampusAccess, CAMPUS_ID_HEADER` from decorators
- Update: findAll(), findById(), update(), archive(), restore()
- Keep: create() uses body (unchanged)

**2. danger-staff.controller.ts** - 1 method
- Remove `requireCampusId()` helper (lines 41-55)
- Remove local CAMPUS_ID_HEADER constant (line 21)
- Import: `CampusContext, RequireCampusAccess, CAMPUS_ID_HEADER` from decorators
- Update: hardDelete()

### Phase 2: Reference Data Controllers
**3. reference-data.controller.ts** - 3 methods
- Import: `CampusContext, RequireCampusAccess, CAMPUS_ID_HEADER` from decorators
- Add `ApiHeader` to imports from swagger
- Update: getGradeLevels(), getSchoolYears(), getSubjects()
- Change @ApiQuery to @ApiHeader for campusId

### Phase 3: Content Management Controllers
**4. post.controller.ts** - 2 methods
- Import: `CampusContext, RequireCampusAccess, CAMPUS_ID_HEADER` from decorators
- Add @ApiHeader decorator
- Update: getPendingApprovals(), getPinnedPosts()

**5. campus-setting.controller.ts** - 2 methods
- Import: `CampusContext, RequireCampusAccess, CAMPUS_ID_HEADER` from decorators
- Update: getCampusSettings(), updateCampusSettings()
- Change @ApiQuery to @ApiHeader

**6. post-category.controller.ts** - 1 method
- Import: `CampusContext, RequireCampusAccess, CAMPUS_ID_HEADER` from decorators
- Update: findAll()
- Keep: create() uses body (unchanged)

### Phase 4: Class & File Controllers
**7. class.controller.ts** - 1 method
- Import: `CampusContext, RequireCampusAccess, CAMPUS_ID_HEADER` from decorators
- Update: findAll()

**8. file.controller.ts** - 1 method (special case)
- Import: `RequireCampusAccess` from decorators
- Add @RequireCampusAccess() to initiateUpload() for validation only
- Keep campusId extraction from body (no @CampusContext needed)

**9. staff-type.controller.ts** - verify only
- create() uses body - no changes needed, just verify pattern is correct

### Build Verification
- Run `npm run build` to verify no TypeScript errors
- All 12 acceptance criteria must pass
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Completed (2026-01-10)

### Summary
Successfully migrated all 9 campus-scoped controllers to use the new @RequireCampusAccess() and @CampusContext() decorators.

### Changes Made

**1. staff.controller.ts**
- Removed manual requireCampusId() helper method
- Removed local CAMPUS_ID_HEADER constant
- Updated 5 methods: findAll(), findById(), update(), archive(), restore()
- Added @RequireCampusAccess() and @CampusContext() decorators
- create() kept as-is (uses campusId from body)

**2. danger-staff.controller.ts**
- Removed manual requireCampusId() helper method
- Removed local CAMPUS_ID_HEADER constant
- Updated hardDelete() method

**3. reference-data.controller.ts**
- Updated 3 methods: getGradeLevels(), getSchoolYears(), getSubjects()
- Changed @ApiQuery to @ApiHeader for campusId

**4. post.controller.ts**
- Updated 2 methods: getPendingApprovals(), getPinnedPosts()
- Added @ApiHeader decorators

**5. campus-setting.controller.ts**
- Updated 2 methods: getCampusSettings(), updateCampusSettings()
- Changed @ApiQuery to @ApiHeader

**6. post-category.controller.ts**
- Updated findAll() method
- create() kept as-is (uses campusId from body)

**7. class.controller.ts**
- Updated findAll() method

**8. file.controller.ts**
- Added @RequireCampusAccess() to initiateUpload() for validation
- Kept campusId extraction from body

**9. staff-type.controller.ts**
- Verified: No changes needed (create() uses body)

### Build Status: PASSED
<!-- SECTION:NOTES:END -->

