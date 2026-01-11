---
id: '30'
title: 'Post & CMS: Infrastructure - Create Prisma repository implementations'
status: done
priority: medium
labels:
  - post
  - infrastructure
  - repository
  - phase-3
createdAt: '2026-01-09T03:11:10.468Z'
updatedAt: '2026-01-09T19:34:11.056Z'
timeSpent: 535
---
# Post & CMS: Infrastructure - Create Prisma repository implementations

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create Prisma repository implementations for new Post & CMS entities.

**Context:**
- Implement abstract repository ports created in task-28
- Follow existing patterns (see PrismaStaffRepository, PrismaGuardianRepository)
- Use PrismaQueryService for pagination/filtering
- Inject via module providers
- Reference: @doc/patterns/repository-pattern

**Repositories to Create:**
1. PrismaPostCategoryRepository - manages post categories per campus
2. PrismaPostReactionRepository - toggle pattern for post likes
3. PrismaPostCommentRepository - threaded/nested comments with soft delete
4. PrismaPostApprovalRequestRepository - approval workflow queue
5. PrismaCampusSettingRepository - campus-specific CMS settings

**Dependencies:**
- All mappers exist (task-29 completed)
- All port interfaces exist (task-28 completed)
- Domain entities exist

**Key Implementation Notes:**
- PostCategoryRepository: Use executeQuery for paginated findByCampusId, getMaxOrder uses aggregate
- PostReactionRepository: Toggle pattern (save/delete), composite key (postId, userId)
- PostCommentRepository: Self-referential queries for threading, soft delete pattern
- PostApprovalRequestRepository: Join with Post table for campus-based pending queue
- CampusSettingRepository: Upsert pattern for settings that should always exist
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PrismaPostCategoryRepository implements all port methods with proper Prisma queries
- [x] #2 PrismaPostReactionRepository implements toggle pattern (upsert/delete)
- [x] #3 PrismaPostCommentRepository implements tree queries for nested comments
- [x] #4 PrismaPostApprovalRequestRepository implements pending queue queries
- [x] #5 PrismaCampusSettingRepository implements upsert pattern
- [x] #6 All repositories use mappers for domain conversion
- [x] #7 Proper field whitelisting for filter/sort operations
- [x] #8 All repositories are @Injectable()
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create PrismaPostCategoryRepository in src/infra/persistence/prisma/repositories/:
   - Inject PrismaService, PrismaQueryService
   - findById: findUnique with id
   - findByCampusId: executeQuery with campus filter, include pagination with allowedFilterFields=[name, isActive, order], allowedSortFields=[createdAt, order, name]
   - findByNameInCampus: findFirst with campusId + name (case-insensitive)
   - findActivesByCampusId: findMany with isActive=true, ordered by order ASC
   - getMaxOrder: aggregate _max on order field with campusId filter
   - save: create with PrismaPostCategoryMapper.toPrisma
   - update: update with PrismaPostCategoryMapper.toPrismaUpdate
   - delete: delete by id

2. Create PrismaPostReactionRepository:
   - Inject PrismaService
   - findByPostAndUser: findFirst with postId + userId
   - existsByPostAndUser: count > 0 check
   - countByPost: count with postId filter
   - findUserIdsByPost: findMany select userId only
   - findByPostId: findMany with postId, map to domain
   - save: create with PrismaPostReactionMapper.toPrisma
   - delete: deleteMany where postId + userId

3. Create PrismaPostCommentRepository:
   - Inject PrismaService, PrismaQueryService
   - findById: findUnique with id
   - findByPostId: executeQuery with postId filter, allowedFilterFields=[userId, isDeleted], allowedSortFields=[createdAt]
   - findRootCommentsByPostId: executeQuery where parentCommentId=null, depth=0
   - findRepliesByCommentId: findMany where parentCommentId=id, ordered by createdAt
   - countByPost: count with postId
   - countActiveByPost: count with postId + isDeleted=false
   - save: create with PrismaPostCommentMapper.toPrisma
   - update: update with PrismaPostCommentMapper.toPrismaUpdate
   - softDelete: update isDeleted=true, deletedAt=now, deletedById

4. Create PrismaPostApprovalRequestRepository:
   - Inject PrismaService, PrismaQueryService
   - findById: findUnique with submittedBy/reviewedBy includes
   - findByPostId: findMany ordered by submittedAt DESC
   - findLatestByPostId: findFirst ordered by submittedAt DESC
   - findPendingByCampus: executeQuery joining Post table, filter status=PENDING
   - findByCampusAndStatus: executeQuery with status filter
   - countPendingByCampus: count with join and status=PENDING
   - save: create with PrismaPostApprovalRequestMapper.toPrisma
   - update: update with PrismaPostApprovalRequestMapper.toPrismaUpdate

5. Create PrismaCampusSettingRepository:
   - Inject PrismaService
   - findByCampusId: findUnique where campusId
   - save: create with PrismaCampusSettingMapper.toPrisma
   - update: update with PrismaCampusSettingMapper.toPrismaUpdate
   - upsert: upsert with create/update data from mapper

6. Add @Injectable() decorator to all repositories

7. Export all new repositories from index.ts
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete (2026-01-09)

Created 5 Prisma repository implementations for Post & CMS entities:

1. **PrismaPostCategoryRepository** (prisma-post-category.repository.ts)
   - findById, findByCampusId (paginated), findByNameInCampus (case-insensitive)
   - findActivesByCampusId, getMaxOrder (aggregate), save, update, delete
   - Allowed filter fields: name, isActive, order
   - Allowed sort fields: createdAt, updatedAt, order, name

2. **PrismaPostReactionRepository** (prisma-post-reaction.repository.ts)
   - findByPostAndUser, existsByPostAndUser, countByPost, findUserIdsByPost
   - findByPostId, save, delete (composite key postId+userId)
   - No PrismaQueryService needed (no pagination)

3. **PrismaPostCommentRepository** (prisma-post-comment.repository.ts)
   - findById, findByPostId (paginated), findRootCommentsByPostId (paginated)
   - findRepliesByCommentId, countByPost, countActiveByPost
   - save, update, softDelete (sets isDeleted, deletedAt, deletedById)
   - Allowed filter fields: userId, isDeleted, depth

4. **PrismaPostApprovalRequestRepository** (prisma-post-approval-request.repository.ts)
   - findById, findByPostId, findLatestByPostId
   - findPendingByCampus (paginated), findByCampusAndStatus (paginated)
   - countPendingByCampus, save, update
   - Campus filtering via Post table join

5. **PrismaCampusSettingRepository** (prisma-campus-setting.repository.ts)
   - findByCampusId, save, update, upsert
   - No PrismaQueryService needed (single record per campus)

All repositories:
- Are @Injectable() decorated
- Use proper mappers for domain conversion
- Exported from index.ts
- TypeScript compiles without errors
<!-- SECTION:NOTES:END -->

