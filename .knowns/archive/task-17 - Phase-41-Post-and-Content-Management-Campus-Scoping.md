---
id: '17'
title: 'Phase 4.1: Post and Content Management Campus Scoping'
status: done
priority: high
labels:
  - domain
  - post
  - content
  - campus-scoping
  - phase-4
createdAt: '2026-01-06T04:30:27.497Z'
updatedAt: '2026-01-11T03:12:13.625Z'
timeSpent: 872
assignee: '@me'
---
# Phase 4.1: Post and Content Management Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Post, PostAudience, and related content management entities for campus scoping.

Depends on @task-8 (Schema), @task-9 (Campus module).
See @doc/migrations/multi-campus-migration for context.

## Post Entity Changes

### Domain Layer
**File**: src/domain/content-management/entities/post.entity.ts
- Add: campusId property (required)
- Posts are campus-isolated (cannot target audiences across campuses)

**File**: src/domain/content-management/entities/post-audience.entity.ts
- Add: campusId property (required)
- Audience targets (class, grade, student) must be from same campus

### Application Layer

**Port Update**: src/application/content-management/ports/post.repository.ts
- Add: findByCampusId(campusId, params)
- Update: findAll to filter by campusId

**Use Case Updates**:
- create-post.use-case.ts
  - Require campusId
  - Validate audiences are from same campus
  - Author must have access to campus
  
- list-posts.use-case.ts
  - Filter by campusId
  
- All transition use cases
  - Verify campus access
  
- add-attachment.use-case.ts
  - Verify file belongs to same campus

### Infrastructure Layer

**Repository**: prisma-post.repository.ts
- Update for campus filtering
- Include campus relation
- Validate audience targets are in same campus

**Mapper**: prisma-post.mapper.ts
- Add campusId mapping

### HTTP Layer

**Controller**: post.controller.ts
- Get campusId from auth context
- Pass campusId to all use cases
- Validate author has campus access

**DTOs**:
- create-post.request.ts - Add campusId (optional if from context)
- post.response.ts - Add campusId

## Validation Rules
- Post audiences (classes, grades, students) must all be from the post's campus
- Only users with campus access can create/view posts
- Attachments must reference files from same campus
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Post entity has campusId property
- [ ] #2 PostAudience entity has campusId property
- [ ] #3 Post repository updated for campus filtering
- [ ] #4 Create-post requires campusId
- [ ] #5 Create-post validates audiences are in same campus
- [ ] #6 List-posts filters by campus
- [ ] #7 Post transitions verify campus access
- [ ] #8 Attachments verify file is from same campus
- [ ] #9 Mappers updated with campusId
- [ ] #10 DTOs include campusId
- [ ] #11 Cross-campus posts prevented
- [ ] #12 Tests updated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan for Task 17: Post and Content Management Campus Scoping

### Current State (70% Complete)

**Already Implemented:**
- Post & PostAudience entities have campusId property
- Post.create() validates campusId is required
- Repository has campusId in allowedFilterFields + findPinnedByCampus/countPinnedByCampus
- Mapper correctly maps campusId both directions
- CreatePostRequest & PostResponse DTOs have campusId
- 2 endpoints use @RequireCampusAccess(): getPendingApprovals, getPinnedPosts

### Phase 1: Application Layer - Audience Validation

**Step 1.1: Create Audience Validation Utility**
File: src/application/content-management/utils/audience-validator.ts
- Create validateAudiencesBelongToCampus(audiences[], campusId, classRepo, gradeLevelRepo, studentRepo)
- Validate that each audience target (class/grade/student ID) belongs to the specified campus
- Throw BadRequestException if cross-campus targets detected

**Step 1.2: Update CreatePostUseCase**
File: src/application/content-management/use-cases/create-post.use-case.ts
- Inject ClassRepository, GradeLevelRepository, StudentRepository
- Before creating post, call audience validation utility
- Add campusId parameter validation

**Step 1.3: Update UpdatePostUseCase**
File: src/application/content-management/use-cases/update-post.use-case.ts
- Add campusId to input interface
- Verify user has access to post's campus
- If audiences are updated, validate new audiences belong to post's campus

### Phase 2: Application Layer - Campus Access in Use Cases

**Step 2.1: ListPostsUseCase**
File: src/application/content-management/use-cases/list-posts.use-case.ts
- Add campusId required parameter
- Force campus filter in query (not optional)

**Step 2.2: Transition Use Cases**
Files:
- approve-post.use-case.ts
- reject-post.use-case.ts
- publish-post.use-case.ts
- archive-post.use-case.ts
- revise-post.use-case.ts
- submit-for-review.use-case.ts
For each:
- Add campusId to input
- Verify post belongs to the specified campus before transition

**Step 2.3: AddAttachmentUseCase**
File: src/application/content-management/use-cases/add-attachment.use-case.ts
- Inject FileRepository
- Validate file exists and belongs to same campus as post
- Throw BadRequestException if cross-campus file

### Phase 3: HTTP Layer - Controller Updates

**Step 3.1: Apply @RequireCampusAccess() to all endpoints**
File: src/infra/http/controllers/post.controller.ts
Add decorator to:
- create() - POST /posts
- findMany() - GET /posts
- findOne() - GET /posts/:id
- update() - PATCH /posts/:id
- remove() - DELETE /posts/:id
- addAttachment() - POST /posts/:id/attachments
- removeAttachment() - DELETE /posts/:id/attachments/:attachmentId
- reorderAttachments() - PATCH /posts/:id/attachments/reorder
- transition() - POST /posts/:id/transition
- getHistory() - GET /posts/:id/history
- toggleHeart() - POST /posts/:id/heart
- getHeartStatus() - GET /posts/:id/heart
- pinPost() - POST /posts/:id/pin
- unpinPost() - DELETE /posts/:id/pin

**Step 3.2: Use @CampusContext() to pass campusId**
For each endpoint:
- Add @CampusContext() campusId: string parameter
- Pass campusId to use case execute() method

### Phase 4: DTO Updates

**Step 4.1: PostAudienceResponse**
File: src/infra/http/dtos/post/post.response.ts (or separate file)
- Add campusId: string field with @Expose() decorator

### Phase 5: Testing

**Step 5.1: Unit Tests**
- Audience validation utility tests
- Use case tests with campus validation

**Step 5.2: Integration Tests**
- Cross-campus post creation blocked
- Cross-campus audience assignment blocked
- Cross-campus file attachment blocked

### Files to Create:
1. src/application/content-management/utils/audience-validator.ts

### Files to Modify:
1. src/application/content-management/use-cases/create-post.use-case.ts
2. src/application/content-management/use-cases/update-post.use-case.ts
3. src/application/content-management/use-cases/list-posts.use-case.ts
4. src/application/content-management/use-cases/approve-post.use-case.ts
5. src/application/content-management/use-cases/reject-post.use-case.ts
6. src/application/content-management/use-cases/publish-post.use-case.ts
7. src/application/content-management/use-cases/archive-post.use-case.ts
8. src/application/content-management/use-cases/revise-post.use-case.ts
9. src/application/content-management/use-cases/submit-for-review.use-case.ts
10. src/application/content-management/use-cases/add-attachment.use-case.ts (if exists)
11. src/infra/http/controllers/post.controller.ts
12. src/infra/http/dtos/post/post.response.ts

### Execution Order:
1. Phase 1 (Audience Validation) - Foundation for validation
2. Phase 2 (Use Case Updates) - Core business logic
3. Phase 3 (Controller Updates) - HTTP layer integration
4. Phase 4 (DTO Updates) - Response formatting
5. Phase 5 (Testing) - Verify implementation
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### Review Notes (2026-01-10)

**Implementation Status: ~70% complete**

**Completed:**
- Post & PostAudience entities with campusId
- Repository with campus filtering (allowedFilterFields)
- Mappers with campusId mapping
- DTOs (CreatePostRequest, PostResponse) with campusId

**Missing Critical Items:**
1. Audience targets validation - No check that Class/GradeLevel/Student belong to post's campus
2. ListPostsUseCase - Does NOT auto-filter by user's campus from auth context
3. Transition use-cases (approve, reject, publish, archive) - No campus access verification
4. AddAttachmentUseCase - No validation that file belongs to same campus as post
5. PostAudienceResponse DTO - Missing campusId field

**Blocking Issue:** Depends on Task 21 (Campus Context) for proper auth-based campus filtering.

## Implementation Completed

### 1. Audience Validation Utility
- Created `src/application/content-management/utils/validate-audiences-campus.ts`
- Validates Class, GradeLevel, and Student IDs belong to specified campus
- Supports batched validation for efficiency

### 2. Use Case Updates
- **CreatePostUseCase**: Added repository injections and audience validation before post creation
- **UpdatePostUseCase**: Added campusId to input, campus verification, and audience validation
- **ListPostsUseCase**: Forces campus filter on all queries via JSON filter parsing
- **GetPostUseCase, DeletePostUseCase, GetPostHistoryUseCase**: Added campusId parameter and verification
- **All transition use cases** (approve, reject, publish, archive, revise, submit-for-review): Added campusId parameter and campus verification
- **Attachment use cases** (add, remove, reorder): Added campusId and file campus validation
- **Pin use cases** (pin, unpin): Added campus verification
- **Reaction use cases** (toggle, get-status): Added campusId parameter and verification
- **GetPostApprovalHistoryUseCase**: Added campus verification

### 3. Controller Updates
- Completely updated PostController with:
  - `@RequireCampusAccess()` guard on ALL endpoints
  - `@CampusContext() campusId: string` decorator parameter
  - `@ApiHeader()` for x-campus-id documentation
  - All use case calls now pass campusId

### 4. DTO Updates
- Added campusId field to PostAudienceResponse with @Expose()

### Build verified passing.
<!-- SECTION:NOTES:END -->

