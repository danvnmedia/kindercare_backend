---
id: '33'
title: 'Post & CMS: Comments Feature - Nested comments with depth limit'
status: done
priority: medium
labels:
  - post
  - comments
  - use-case
  - controller
  - phase-4
createdAt: '2026-01-09T03:12:24.853Z'
updatedAt: '2026-01-10T02:22:08.232Z'
timeSpent: 615
---
# Post & CMS: Comments Feature - Nested comments with depth limit

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement nested comments feature for posts with 3-level depth limit.

**Analysis Summary:**
The PostComment entity, repository port, Prisma repository, and mapper already exist with full implementation:
- Entity has MAX_COMMENT_DEPTH=3 constant and canReply() checking depth < 2 (allows 3 levels: 0, 1, 2)
- Repository port has all needed methods: findById, findByPostId, findRootCommentsByPostId, findRepliesByCommentId, countByPost, countActiveByPost, save, update, softDelete
- Prisma schema includes indexes on (postId, createdAt), (postId, parentCommentId), (parentCommentId), (userId), (isDeleted), (depth)
- CampusSetting.allowParentComments controls whether parent/guardians can comment

**What Needs to be Created:**
1. 5 Use Cases for comment operations
2. 3 DTOs (CreateCommentRequest, UpdateCommentRequest, PostCommentResponse)
3. CommentController with 5 endpoints
4. Module registration for new use cases and repository

**Context:**
- Comments support nesting via parent_comment_id
- Maximum 3 levels (depth 0=root, 1=reply, 2=reply-to-reply)
- Entity's canReply() returns false when depth >= 2 (cannot reply to depth 2 comments)
- Soft delete preserves audit trail with deletedById tracking
- Reference: @doc/prds/post-and-content-management
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CreatePostCommentUseCase creates root comment with depth=0
- [x] #2 UpdatePostCommentUseCase validates user owns comment
- [x] #3 DeletePostCommentUseCase soft deletes with deletedById tracking
- [x] #4 GetPostCommentsUseCase returns nested tree structure
- [x] #5 API returns 400 when replying to comment at max depth
- [x] #6 API returns 400 when replying to deleted comment
- [x] #7 Deleted comments show placeholder text but replies remain visible
- [x] #8 Request/Response DTOs created with validation
- [x] #9 CreateCommentReplyUseCase uses parent.canReply() to validate depth < 2 (max 3 levels)
- [x] #10 CreateCommentReplyUseCase sets depth = parent.depth + 1
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Phase 1: Create Comment Use Cases

Create use cases in src/application/content-management/use-cases/comment/:

### 1.1 CreatePostCommentUseCase
- Inject PostCommentRepository, PostRepository, CampusSettingRepository
- Validate post exists and is published (canReceiveEngagement)
- Check campus setting allowParentComments if user is parent/guardian
- Create comment with depth=0, parentCommentId=null using PostComment.create()
- Save and return with comment data

### 1.2 CreateCommentReplyUseCase
- Find parent comment by ID
- Validate parent not deleted
- Use parent.canReply() to check depth (returns false if depth >= 2)
- Throw BadRequestException if cannot reply (deleted or max depth)
- Create reply with depth=parent.depth+1, parentCommentId=parent.id
- Save and return

### 1.3 UpdatePostCommentUseCase
- Find comment by ID
- Validate user owns comment (comment.userId === currentUser.id)
- Call comment.updateContent(newContent) - entity validates not deleted
- Save and return updated comment

### 1.4 DeletePostCommentUseCase
- Find comment by ID
- Validate user owns comment OR is post author OR has admin role
- Call comment.softDelete(currentUser.id) on entity
- Save (preserves replies, replies remain visible)

### 1.5 GetPostCommentsUseCase
- Fetch all comments for post using findByPostId with pagination
- Build nested tree structure in memory:
  - Group comments by parentCommentId
  - Recursively attach children to parents
- Mark deleted comments with placeholder indicator
- Return tree with reply counts

## Phase 2: Create DTOs

Create in src/infra/http/dtos/comment/:

### 2.1 CreateCommentRequest
- content: string, @IsNotEmpty, @MaxLength(1000)

### 2.2 UpdateCommentRequest  
- content: string, @IsNotEmpty, @MaxLength(1000)

### 2.3 PostCommentResponse
- id, postId, userId, parentCommentId, depth
- content (or placeholder if deleted)
- isDeleted, createdAt, updatedAt
- replies: PostCommentResponse[] (nested)
- replyCount: number

## Phase 3: Create CommentController

Create src/infra/http/controllers/comment.controller.ts:

### Endpoints:
- GET /posts/:postId/comments - GetPostCommentsUseCase
- POST /posts/:postId/comments - CreatePostCommentUseCase
- POST /comments/:commentId/replies - CreateCommentReplyUseCase
- PATCH /comments/:commentId - UpdatePostCommentUseCase  
- DELETE /comments/:commentId - DeletePostCommentUseCase

### Guards:
- @UseGuards(ClerkAuthGuard) on controller class
- @CurrentUser() decorator for use case calls

## Phase 4: Module Registration

Update src/infra/http/modules/content-management.module.ts:

### Providers to add:
- CreatePostCommentUseCase
- CreateCommentReplyUseCase
- UpdatePostCommentUseCase
- DeletePostCommentUseCase
- GetPostCommentsUseCase
- { provide: "POST_COMMENT_REPOSITORY", useClass: PrismaPostCommentRepository }

### Exports:
- POST_COMMENT_REPOSITORY (for potential use in other modules)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete (2026-01-09)

### Files Created:

**Use Cases (5):**
- src/application/content-management/use-cases/comment/create-post-comment.use-case.ts
- src/application/content-management/use-cases/comment/create-comment-reply.use-case.ts
- src/application/content-management/use-cases/comment/update-post-comment.use-case.ts
- src/application/content-management/use-cases/comment/delete-post-comment.use-case.ts
- src/application/content-management/use-cases/comment/get-post-comments.use-case.ts
- src/application/content-management/use-cases/comment/index.ts

**DTOs (4):**
- src/infra/http/dtos/comment/create-comment.request.ts
- src/infra/http/dtos/comment/update-comment.request.ts
- src/infra/http/dtos/comment/comment.response.ts
- src/infra/http/dtos/comment/index.ts

**Controller (1):**
- src/infra/http/controllers/comment.controller.ts

### Files Modified:
- src/application/content-management/use-cases/index.ts (added comment export)
- src/infra/http/modules/content-management.module.ts (registered controller, use cases, repository)

### API Endpoints:
- GET /posts/:postId/comments - List comments with nested tree
- POST /posts/:postId/comments - Create root comment
- POST /comments/:commentId/replies - Reply to comment
- PATCH /comments/:commentId - Edit comment
- DELETE /comments/:commentId - Soft delete comment

### Key Implementation Details:
- Uses existing PostComment entity with canReply() method for depth validation (depth < 2)
- Tree structure built in-memory in GetPostCommentsUseCase
- Soft delete preserves replies with deletedById audit trail
- Authorization: owner can edit/delete, post author and admin can delete any comment
<!-- SECTION:NOTES:END -->

