---
id: '33'
title: 'Post & CMS: Comments Feature - Nested comments with depth limit'
status: todo
priority: medium
labels:
  - post
  - comments
  - use-case
  - controller
  - phase-4
createdAt: '2026-01-09T03:12:24.853Z'
updatedAt: '2026-01-09T03:12:53.371Z'
timeSpent: 0
---
# Post & CMS: Comments Feature - Nested comments with depth limit

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement nested comments feature for posts with 3-level depth limit.

**Context:**
- Comments support nesting via parent_comment_id
- Maximum depth of 3 levels (0=root, 1=reply, 2=reply-to-reply, 3=max)
- Soft delete preserves audit trail
- Author/admin can delete any comment
- Reference: @doc/prds/post-and-content-management

**Use Cases:**
1. CreatePostCommentUseCase - create root comment (depth=0)
2. CreateCommentReplyUseCase - create reply with depth check
3. UpdatePostCommentUseCase - edit own comment
4. DeletePostCommentUseCase - soft delete
5. GetPostCommentsUseCase - get comments tree

**API Endpoints:**
- GET /posts/:id/comments - list comments (nested tree)
- POST /posts/:id/comments - add root comment
- POST /comments/:id/replies - add reply
- PATCH /comments/:id - edit comment
- DELETE /comments/:id - soft delete
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CreatePostCommentUseCase creates root comment with depth=0
- [ ] #2 CreateCommentReplyUseCase validates parent exists and depth < 3
- [ ] #3 CreateCommentReplyUseCase sets depth = parent.depth + 1
- [ ] #4 UpdatePostCommentUseCase validates user owns comment
- [ ] #5 DeletePostCommentUseCase soft deletes with deletedById tracking
- [ ] #6 GetPostCommentsUseCase returns nested tree structure
- [ ] #7 API returns 400 when replying to comment at max depth
- [ ] #8 API returns 400 when replying to deleted comment
- [ ] #9 Deleted comments show placeholder text but replies remain visible
- [ ] #10 Request/Response DTOs created with validation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create use cases in src/application/content-management/use-cases/comment/:
   a. CreatePostCommentUseCase:
      - Inject PostCommentRepository, PostRepository, CampusSettingRepository
      - Validate post exists and is published
      - Check campus setting allowParentComments
      - Create comment with depth=0, parentCommentId=null
      - Save and return with user info
   b. CreateCommentReplyUseCase:
      - Find parent comment
      - Validate parent not deleted
      - Validate parent.depth < 3 (max depth check)
      - Create reply with depth=parent.depth+1, parentCommentId=parent.id
      - Save and return
   c. UpdatePostCommentUseCase:
      - Find comment
      - Validate user owns comment OR is admin
      - Update content via entity method
      - Save and return
   d. DeletePostCommentUseCase:
      - Find comment
      - Validate user owns comment OR is post author OR is admin
      - Call softDelete(deletedById) on entity
      - Save (preserves replies)
   e. GetPostCommentsUseCase:
      - Fetch all comments for post
      - Build nested tree structure in memory
      - Return with user info and reply counts
2. Create DTOs:
   - CreateCommentRequest: content (max 1000 chars)
   - UpdateCommentRequest: content (max 1000 chars)
   - PostCommentResponse: id, postId, userId, userName, parentCommentId, depth, content, isDeleted, createdAt, updatedAt, replies[]
3. Create endpoints in PostController or separate CommentController:
   - GET /posts/:id/comments
   - POST /posts/:id/comments
   - POST /comments/:id/replies
   - PATCH /comments/:id
   - DELETE /comments/:id
4. Handle deleted comment display (show 'This comment has been deleted' placeholder)
5. Add repository bindings
<!-- SECTION:PLAN:END -->

