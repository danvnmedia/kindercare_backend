---
id: '35'
title: 'Post & CMS: Pinning Feature - Pin posts to top of feed'
status: todo
priority: low
labels:
  - post
  - pinning
  - use-case
  - controller
  - phase-5
createdAt: '2026-01-09T03:12:28.186Z'
updatedAt: '2026-01-09T03:12:56.540Z'
timeSpent: 0
---
# Post & CMS: Pinning Feature - Pin posts to top of feed

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement post pinning feature for campus admins.

**Context:**
- Only admin can pin/unpin posts
- Maximum 3 pinned posts per campus (configurable in CampusSetting)
- Optional expiration date for pins
- Pinned posts appear at top of feed
- Reference: @doc/prds/post-and-content-management

**Use Cases:**
1. PinPostUseCase - pin post with optional expiration
2. UnpinPostUseCase - unpin post
3. GetPinnedPostsUseCase - list pinned posts for campus

**API Endpoints:**
- POST /posts/:id/pin - pin post (admin)
- DELETE /posts/:id/pin - unpin post (admin)
- GET /posts/pinned - list pinned posts

**Feed Integration:**
- Update ListPostsUseCase to return pinned posts first
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PinPostUseCase validates admin permission
- [ ] #2 PinPostUseCase checks max pinned limit from CampusSetting
- [ ] #3 PinPostUseCase returns 400 if limit exceeded with helpful message
- [ ] #4 PinPostUseCase sets isPinned, pinnedUntil, pinnedById
- [ ] #5 UnpinPostUseCase clears pinning fields
- [ ] #6 GetPinnedPostsUseCase returns active pinned posts (not expired)
- [ ] #7 ListPostsUseCase updated to return pinned posts first in feed
- [ ] #8 Expired pins automatically excluded from pinned list
- [ ] #9 Request DTO allows optional pinnedUntil date
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create use cases in src/application/content-management/use-cases/pin/:
   a. PinPostUseCase:
      - Inject PostRepository, CampusSettingRepository
      - Validate caller is admin
      - Validate post is PUBLISHED
      - Get campus setting for maxPinnedPosts
      - Count current pinned posts (not expired)
      - If count >= max, return 400 with message
      - Call post.pin(pinnedById, pinnedUntil) entity method
      - Save and return
   b. UnpinPostUseCase:
      - Validate caller is admin
      - Validate post is currently pinned
      - Call post.unpin() entity method
      - Save and return
   c. GetPinnedPostsUseCase:
      - Query posts where isPinned=true AND (pinnedUntil is null OR pinnedUntil > now)
      - Filter by campusId
      - Order by pinnedAt or createdAt
      - Return list
2. Update Post entity:
   - Add pin(pinnedById, pinnedUntil?) method
   - Add unpin() method
   - Add isPinnedAndActive() check method
3. Update ListPostsUseCase:
   - Modify query to return pinned posts first
   - Add isPinned to response
4. Create DTOs:
   - PinPostRequest: pinnedUntil? (optional DateTime)
   - PinnedPostResponse: extends PostResponse with isPinned, pinnedUntil, pinnedBy
5. Add endpoints to PostController:
   - POST /posts/:id/pin
   - DELETE /posts/:id/pin
   - GET /posts/pinned
6. Add admin permission guard for pin/unpin operations
<!-- SECTION:PLAN:END -->

