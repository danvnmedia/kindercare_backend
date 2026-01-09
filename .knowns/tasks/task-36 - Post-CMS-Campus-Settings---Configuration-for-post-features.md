---
id: '36'
title: 'Post & CMS: Campus Settings - Configuration for post features'
status: todo
priority: medium
labels:
  - post
  - settings
  - use-case
  - controller
  - phase-4
createdAt: '2026-01-09T03:13:20.407Z'
updatedAt: '2026-01-09T03:13:47.049Z'
timeSpent: 0
---
# Post & CMS: Campus Settings - Configuration for post features

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement campus-level settings for Post & CMS features.

**Context:**
- Each campus can configure post-related settings
- Settings control: approval requirement, max pinned posts, comments, reactions
- Admin-only management
- Reference: @doc/prds/post-and-content-management

**Settings:**
- requireTeacherApproval: boolean (default true)
- maxPinnedPosts: number (default 3)
- allowParentComments: boolean (default true)
- allowReactions: boolean (default true)

**Use Cases:**
1. GetCampusSettingUseCase - get settings for campus (create default if not exists)
2. UpdateCampusSettingUseCase - update settings

**API Endpoints:**
- GET /campus-settings - get current campus settings
- PATCH /campus-settings - update settings (admin)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GetCampusSettingUseCase returns existing or creates default settings
- [ ] #2 UpdateCampusSettingUseCase validates admin permission
- [ ] #3 UpdateCampusSettingUseCase updates only provided fields
- [ ] #4 Settings used by other use cases (approval, comments, reactions, pinning)
- [ ] #5 Request/Response DTOs created
- [ ] #6 Admin guard on update endpoint
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create use cases in src/application/content-management/use-cases/settings/:
   a. GetCampusSettingUseCase:
      - Inject CampusSettingRepository
      - Find by campusId
      - If not exists, create default:
        - requireTeacherApproval: true
        - maxPinnedPosts: 3
        - allowParentComments: true
        - allowReactions: true
      - Return settings
   b. UpdateCampusSettingUseCase:
      - Validate caller is admin
      - Get existing settings (or create default)
      - Update only provided fields via entity method
      - Save and return
2. Create DTOs in src/infra/http/dtos/content-management/settings/:
   - UpdateCampusSettingRequest: all fields optional
   - CampusSettingResponse: all fields
3. Create CampusSettingController:
   - GET /campus-settings - get (with x-campus-id header)
   - PATCH /campus-settings - update (admin only)
4. Add admin guard to PATCH endpoint
5. Integrate with other features:
   - SubmitPostForApprovalUseCase checks requireTeacherApproval
   - CreatePostCommentUseCase checks allowParentComments
   - TogglePostReactionUseCase checks allowReactions
   - PinPostUseCase checks maxPinnedPosts
6. Add repository binding to module
<!-- SECTION:PLAN:END -->

