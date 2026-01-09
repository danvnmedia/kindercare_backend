---
id: '38'
title: 'Post & CMS: Module Integration and Dependency Wiring'
status: todo
priority: medium
labels:
  - post
  - module
  - integration
  - phase-5
createdAt: '2026-01-09T03:13:23.886Z'
updatedAt: '2026-01-09T03:13:50.357Z'
timeSpent: 0
---
# Post & CMS: Module Integration and Dependency Wiring

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wire up all new components in NestJS modules with proper dependency injection.

**Context:**
- All new repositories, use cases need module bindings
- Follow existing module patterns (see UserManagementModule, ClassManagementModule)
- Ensure proper exports for cross-module usage
- Reference: @doc/patterns/module-pattern

**Tasks:**
1. Update ContentManagementModule with new providers
2. Add repository bindings with string tokens
3. Export necessary repositories
4. Create new controllers or add to existing
5. Ensure all dependencies resolve correctly
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All new repositories bound with @Inject tokens
- [ ] #2 All new use cases registered as providers
- [ ] #3 PostCategoryController added to module
- [ ] #4 CommentController added (or endpoints in PostController)
- [ ] #5 CampusSettingController added
- [ ] #6 Module compiles without errors
- [ ] #7 All endpoints accessible and return proper responses
- [ ] #8 Swagger documentation generated correctly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update src/infra/http/modules/content-management.module.ts:
   a. Add repository bindings:
      - { provide: 'POST_CATEGORY_REPOSITORY', useClass: PrismaPostCategoryRepository }
      - { provide: 'POST_REACTION_REPOSITORY', useClass: PrismaPostReactionRepository }
      - { provide: 'POST_COMMENT_REPOSITORY', useClass: PrismaPostCommentRepository }
      - { provide: 'POST_APPROVAL_REQUEST_REPOSITORY', useClass: PrismaPostApprovalRequestRepository }
      - { provide: 'CAMPUS_SETTING_REPOSITORY', useClass: PrismaCampusSettingRepository }
   b. Add use case providers:
      - All category use cases
      - All reaction use cases
      - All comment use cases
      - All approval use cases
      - All pinning use cases
      - All settings use cases
   c. Add controllers:
      - PostCategoryController
      - CommentController (or extend PostController)
      - CampusSettingController
2. Export repositories that may be needed by other modules
3. Ensure PrismaModule is imported
4. Ensure AuthModule is imported (for guards)
5. Test module compilation:
   - npm run build
   - Check for circular dependency warnings
   - Verify all @Inject tokens resolve
6. Test API endpoints:
   - Swagger docs accessible
   - Each endpoint returns expected structure
   - Error handling works correctly
7. Add missing imports/exports to barrel files
<!-- SECTION:PLAN:END -->

