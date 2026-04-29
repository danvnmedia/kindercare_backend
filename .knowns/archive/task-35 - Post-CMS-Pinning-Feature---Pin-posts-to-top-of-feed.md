---
id: '35'
title: 'Post & CMS: Pinning Feature - Pin posts to top of feed'
status: done
priority: low
labels:
  - post
  - pinning
  - use-case
  - controller
  - phase-5
createdAt: '2026-01-09T03:12:28.186Z'
updatedAt: '2026-01-10T04:07:27.792Z'
timeSpent: 714
---
# Post & CMS: Pinning Feature - Pin posts to top of feed

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement post pinning feature for campus admins.

## Analysis Summary

**What Already Exists:**
- Post entity has all pinning fields: `isPinned`, `pinnedUntil`, `pinnedById`
- Post entity has domain methods: `pin(pinnedById, pinnedUntil?)`, `unpin()`, `isPinExpired()`
- CampusSetting entity has `maxPinnedPosts` (default: 3, max: 10)
- Prisma schema has all pinning fields and index on `[campusId, isPinned]`
- PostResponse DTO already exposes `isPinned` and `pinnedUntil`
- PrismaPostMapper handles pinning fields with proper relation connect/disconnect

**What Needs to Be Implemented:**
1. Repository methods for counting/querying pinned posts
2. PinPostUseCase, UnpinPostUseCase, GetPinnedPostsUseCase
3. PinPostRequest DTO with optional pinnedUntil date
4. Controller endpoints: POST/DELETE /posts/:id/pin, GET /posts/pinned
5. Update ListPostsUseCase to return pinned posts first

## Key Patterns to Follow
- Admin validation: `currentUser.roles?.some(r => r.name === "Admin")`
- Use `ForbiddenException` for permission errors, `BadRequestException` for invalid state
- Use `@UseGuards(RolesGuard)` + `@Roles("admin", "super_admin")` for admin endpoints
- Call entity domain methods (post.pin(), post.unpin()) then repository.update()
- CampusSetting accessed via `campusSettingRepository.findByCampusId()`
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PinPostUseCase validates admin permission
- [x] #2 PinPostUseCase checks max pinned limit from CampusSetting
- [x] #3 PinPostUseCase returns 400 if limit exceeded with helpful message
- [x] #4 PinPostUseCase sets isPinned, pinnedUntil, pinnedById
- [x] #5 UnpinPostUseCase clears pinning fields
- [x] #6 GetPinnedPostsUseCase returns active pinned posts (not expired)
- [x] #7 ListPostsUseCase updated to return pinned posts first in feed
- [x] #8 Expired pins automatically excluded from pinned list
- [x] #9 Request DTO allows optional pinnedUntil date
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Repository Layer

### 1.1 Update PostRepository Port
Add methods to `src/application/content-management/ports/post.repository.ts`:
- `countPinnedByCampus(campusId: string): Promise<number>` - Count active pinned posts (not expired)
- `findPinnedByCampus(campusId: string): Promise<Post[]>` - Get pinned posts ordered by pinnedAt

### 1.2 Update PrismaPostRepository
Implement new methods in `src/infra/persistence/prisma/repositories/prisma-post.repository.ts`:
- Use `where: { campusId, isPinned: true, OR: [{ pinnedUntil: null }, { pinnedUntil: { gt: new Date() } }] }`
- Order by `createdAt desc` for consistent ordering

## Phase 2: Use Cases

### 2.1 PinPostUseCase
Create `src/application/content-management/use-cases/pin/pin-post.use-case.ts`:
- Inject PostRepository, CampusSettingRepository
- Validate admin permission (throw ForbiddenException)
- Validate post exists (throw NotFoundException)
- Validate post is PUBLISHED (throw BadRequestException)
- Get campus setting for maxPinnedPosts
- Count current pinned posts via repository
- If count >= max, throw BadRequestException with helpful message
- Call `post.pin(userId, pinnedUntil)` entity method
- Save via `postRepository.update()`

### 2.2 UnpinPostUseCase
Create `src/application/content-management/use-cases/pin/unpin-post.use-case.ts`:
- Inject PostRepository
- Validate admin permission
- Validate post exists
- Call `post.unpin()` entity method (idempotent)
- Save via `postRepository.update()`

### 2.3 GetPinnedPostsUseCase
Create `src/application/content-management/use-cases/pin/get-pinned-posts.use-case.ts`:
- Inject PostRepository
- Call `postRepository.findPinnedByCampus(campusId)`
- Filter out expired pins (use `isPinExpired()` method)
- Return list

## Phase 3: DTOs

### 3.1 PinPostRequest
Create `src/infra/http/dtos/post/pin-post.request.ts`:
- `pinnedUntil?: Date` - Optional expiration date with @IsOptional(), @IsDate(), @Type(() => Date)

## Phase 4: Controller

### 4.1 Add Endpoints to PostController
In `src/infra/http/controllers/post.controller.ts`:

```typescript
@Post(":id/pin")
@UseGuards(RolesGuard)
@Roles("admin", "super_admin")
@ApiOperation({ summary: "Pin a post to top of feed" })
@StandardResponse({ type: PostResponse })
async pinPost(@Param("id") id: string, @Body() dto: PinPostRequest, @CurrentUser() user: User)

@Delete(":id/pin")
@UseGuards(RolesGuard)
@Roles("admin", "super_admin")
@ApiOperation({ summary: "Unpin a post" })
@StandardResponse({ type: PostResponse })
async unpinPost(@Param("id") id: string, @CurrentUser() user: User)

@Get("pinned")
@ApiOperation({ summary: "Get pinned posts for campus" })
@StandardResponse({ type: [PostResponse] })
async getPinnedPosts(@Query("campusId") campusId: string, @CurrentUser() user: User)
```

## Phase 5: Feed Integration

### 5.1 Update ListPostsUseCase
Modify query to return pinned posts first:
- Add `orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }]`
- Or use raw SQL/separate queries to prepend pinned posts

## Phase 6: Module Wiring

### 6.1 Update ContentManagementModule
- Register new use cases as providers
- Export use cases for controller injection
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete

### Files Created:
- `src/application/content-management/use-cases/pin/pin-post.use-case.ts`
- `src/application/content-management/use-cases/pin/unpin-post.use-case.ts`
- `src/application/content-management/use-cases/pin/get-pinned-posts.use-case.ts`
- `src/application/content-management/use-cases/pin/index.ts`
- `src/infra/http/dtos/post/pin-post.request.ts`

### Files Modified:
- `src/application/content-management/ports/post.repository.ts` - Added countPinnedByCampus() and findPinnedByCampus()
- `src/infra/persistence/prisma/repositories/prisma-post.repository.ts` - Implemented pinning queries
- `src/application/content-management/use-cases/index.ts` - Export pin use cases
- `src/infra/http/dtos/post/index.ts` - Export PinPostRequest
- `src/infra/http/controllers/post.controller.ts` - Added pinning endpoints
- `src/infra/http/modules/content-management.module.ts` - Wired up use cases

### API Endpoints:
- GET /posts/pinned?campusId=xxx - Get pinned posts for a campus
- POST /posts/:id/pin - Pin a post (admin only)
- DELETE /posts/:id/pin - Unpin a post (admin only)

### Features:
- Admin permission validation
- Max pinned posts limit check from CampusSetting
- Expiration date support (pinnedUntil)
- Expired pins automatically excluded from queries
- isPinned added to allowed sort/filter fields for ListPosts
<!-- SECTION:NOTES:END -->

