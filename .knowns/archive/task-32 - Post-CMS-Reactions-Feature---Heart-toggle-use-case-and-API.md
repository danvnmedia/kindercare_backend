---
id: '32'
title: 'Post & CMS: Reactions Feature - Heart toggle use case and API'
status: done
priority: medium
labels:
  - post
  - reactions
  - use-case
  - controller
  - phase-4
createdAt: '2026-01-09T03:11:18.377Z'
updatedAt: '2026-01-10T02:01:07.086Z'
timeSpent: 9
---
# Post & CMS: Reactions Feature - Heart toggle use case and API

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Heart reaction feature for posts.

**Context:**
- Only HEART reaction type (simplified from PRD)
- One reaction per user per post (toggle behavior)
- Count reactions per post
- Follow existing use case patterns
- Reference: @doc/patterns/use-case-pattern

**Use Cases:**
1. TogglePostReactionUseCase - creates if not exists, deletes if exists
2. GetPostReactionCountUseCase - returns count
3. GetPostReactionStatusUseCase - returns if current user has reacted

**API Endpoints:**
- POST /posts/:id/heart - toggle reaction
- GET /posts/:id/heart - get reaction status and count
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 TogglePostReactionUseCase creates reaction if not exists
- [x] #2 TogglePostReactionUseCase deletes reaction if exists (toggle)
- [x] #3 TogglePostReactionUseCase returns new state (hearted: boolean, count: number)
- [x] #4 GetPostReactionCountUseCase returns total heart count
- [x] #5 GetPostReactionStatusUseCase returns current user reaction status
- [x] #6 API endpoints added to PostController
- [x] #7 Response DTO created (PostReactionResponse with hearted, count)
- [x] #8 Proper user context extraction from auth
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Verified Implementation Plan (based on codebase analysis)

### Pre-requisites Verified:
- PostReaction entity exists at src/domain/content-management/entities/post-reaction.entity.ts
- PostReactionRepository port exists at src/application/content-management/ports/post-reaction.repository.ts  
- PrismaPostReactionRepository implementation exists at src/infra/persistence/prisma/repositories/prisma-post-reaction.repository.ts
- Mapper exists at src/infra/persistence/prisma/mapper/prisma-post-reaction.mapper.ts
- Repository has all needed methods: findByPostAndUser, countByPost, save, delete

### Step 1: Create Use Cases (src/application/content-management/use-cases/reaction/)
1a. toggle-post-reaction.use-case.ts - Inject POST_REPOSITORY and POST_REACTION_REPOSITORY, validate post exists, toggle reaction
1b. get-post-reaction-status.use-case.ts - Get hearted status and count
1c. Create index.ts barrel export

### Step 2: Create Response DTO (src/infra/http/dtos/post/post-reaction.response.ts)
- hearted: boolean, count: number with @Expose() decorators

### Step 3: Add Controller Endpoints (src/infra/http/controllers/post.controller.ts)  
- POST /posts/:id/heart - toggle reaction
- GET /posts/:id/heart - get status and count

### Step 4: Module Wiring (src/infra/http/modules/content-management.module.ts)
- Add POST_REACTION_REPOSITORY provider
- Add use cases

### Step 5: Update Index Files for exports
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete (2026-01-09)

### Files Created:
- src/application/content-management/use-cases/reaction/toggle-post-reaction.use-case.ts
- src/application/content-management/use-cases/reaction/get-post-reaction-status.use-case.ts
- src/application/content-management/use-cases/reaction/index.ts
- src/infra/http/dtos/post/post-reaction.response.ts

### Files Modified:
- src/infra/http/controllers/post.controller.ts (added heart endpoints)
- src/infra/http/modules/content-management.module.ts (registered repository and use cases)
- src/application/content-management/use-cases/index.ts (exported reaction use cases)
- src/infra/http/dtos/post/index.ts (exported PostReactionResponse)

### API Endpoints Added:
- POST /posts/:id/heart - Toggle heart reaction
- GET /posts/:id/heart - Get heart status and count

### Response Format:
{ hearted: boolean, count: number }

### Pre-existing Build Errors:
Build has 13 pre-existing errors unrelated to this implementation (in prisma-*.mapper.ts, prisma-*.repository.ts files).
<!-- SECTION:NOTES:END -->

