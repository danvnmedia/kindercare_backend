---
id: '32'
title: 'Post & CMS: Reactions Feature - Heart toggle use case and API'
status: todo
priority: medium
labels:
  - post
  - reactions
  - use-case
  - controller
  - phase-4
createdAt: '2026-01-09T03:11:18.377Z'
updatedAt: '2026-01-09T03:11:55.455Z'
timeSpent: 0
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
- [ ] #1 TogglePostReactionUseCase creates reaction if not exists
- [ ] #2 TogglePostReactionUseCase deletes reaction if exists (toggle)
- [ ] #3 TogglePostReactionUseCase returns new state (hearted: boolean, count: number)
- [ ] #4 GetPostReactionCountUseCase returns total heart count
- [ ] #5 GetPostReactionStatusUseCase returns current user reaction status
- [ ] #6 API endpoints added to PostController
- [ ] #7 Response DTO created (PostReactionResponse with hearted, count)
- [ ] #8 Proper user context extraction from auth
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create use cases in src/application/content-management/use-cases/reaction/:
   a. TogglePostReactionUseCase:
      - Inject PostReactionRepository, PostRepository
      - Validate post exists and is published
      - Check if user already reacted
      - If exists: delete and return {hearted: false, count: count-1}
      - If not exists: create and return {hearted: true, count: count+1}
   b. GetPostReactionCountUseCase:
      - Return count from repository
   c. GetPostReactionStatusUseCase:
      - Check if current user has reacted
      - Return {hearted: boolean, count: number}
2. Create DTOs in src/infra/http/dtos/content-management/reaction/:
   - PostReactionResponse: hearted (boolean), count (number)
3. Add endpoints to PostController:
   - POST /posts/:id/heart - toggle (requires auth)
   - GET /posts/:id/heart - get status (requires auth for hearted, public for count)
4. Extract user from ClerkAuthGuard context
5. Handle unauthorized access (return count only, hearted=null)
6. Add repository binding to module
<!-- SECTION:PLAN:END -->

