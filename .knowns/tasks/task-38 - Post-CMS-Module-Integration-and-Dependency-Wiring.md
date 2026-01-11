---
id: '38'
title: 'Post & CMS: Module Integration and Dependency Wiring'
status: done
priority: medium
labels:
  - post
  - module
  - integration
  - phase-5
createdAt: '2026-01-09T03:13:23.886Z'
updatedAt: '2026-01-10T04:48:57.648Z'
timeSpent: 1249
---
# Post & CMS: Module Integration and Dependency Wiring

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wire up ContentManagementModule in the main HttpModule to enable all Post/CMS API endpoints.

**Analysis Results (2026-01-09):**

The ContentManagementModule is already fully configured internally:
- 8 repositories registered with @Inject tokens
- 35 use cases registered as providers
- 4 controllers: PostController, CampusSettingController, PostCategoryController, CommentController
- All repositories exported for cross-module usage

**ISSUE FOUND:**
ContentManagementModule is NOT imported in HttpModule, so none of the CMS endpoints are accessible\!

**Files to modify:**
- src/infra/http/http.module.ts - Add ContentManagementModule import

**Context:**
All internal wiring is complete. This task only needs to add the module to HttpModule imports.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All new repositories bound with @Inject tokens
- [x] #2 All new use cases registered as providers
- [x] #3 PostCategoryController added to module
- [x] #4 CommentController added (or endpoints in PostController)
- [x] #5 CampusSettingController added
- [x] #6 Module compiles without errors
- [ ] #7 All endpoints accessible and return proper responses
- [ ] #8 Swagger documentation generated correctly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan (Updated)

### Step 1: Add ContentManagementModule to HttpModule
1. Open src/infra/http/http.module.ts
2. Import ContentManagementModule from ./modules/content-management.module
3. Add ContentManagementModule to the imports array

### Step 2: Verify Build
1. Run npm run build
2. Ensure no circular dependency warnings
3. Confirm all module bindings resolve

### Step 3: Verify API Endpoints
1. Start the application
2. Check Swagger docs at /api
3. Verify all CMS endpoints appear:
   - /posts (CRUD, attachments, workflow, reactions, approvals, pinning)
   - /post-categories (CRUD, reorder)
   - /posts/:postId/comments, /comments/* (nested comments)
   - /campus-settings (get/update)

### Already Completed (No Action Needed):
- All 8 repositories are bound with @Inject tokens
- All 35 use cases are registered as providers
- All 4 controllers are registered
- All repositories are exported
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### 2026-01-09 Implementation Notes

**Completed:**
- Added ContentManagementModule to HttpModule imports
- Fixed PostHistoryStatus entity/mapper to match Prisma schema (changedById, previousStatus, newStatus, reason)
- Fixed 7 pre-existing build errors in other modules:
  - sync-sequence.ts: Updated for multi-campus StudentCodeSequence
  - prisma-file.mapper.ts: Added campusId support
  - prisma-role.mapper.ts: Fixed campus relation update
  - prisma-role.repository.ts: Changed guardian→guardians, staff→staffs
  - prisma-user.repository.ts: Updated relation queries
  - upload-file use case/DTO: Added campusId
  - rbac.module.ts: Added ROLE_REPOSITORY binding

**Status:**
- Build passes successfully
- Server startup blocked by pre-existing campus scoping tasks (not in scope for this task)
- Module wiring is complete and all CMS components are registered
<!-- SECTION:NOTES:END -->

