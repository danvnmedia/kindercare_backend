---
id: '30'
title: 'Post & CMS: Infrastructure - Create Prisma repository implementations'
status: todo
priority: medium
labels:
  - post
  - infrastructure
  - repository
  - phase-3
createdAt: '2026-01-09T03:11:10.468Z'
updatedAt: '2026-01-09T03:11:44.960Z'
timeSpent: 0
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
1. PrismaPostCategoryRepository
2. PrismaPostReactionRepository
3. PrismaPostCommentRepository (handle tree queries)
4. PrismaPostApprovalRequestRepository
5. PrismaCampusSettingRepository
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrismaPostCategoryRepository implements all port methods with proper Prisma queries
- [ ] #2 PrismaPostReactionRepository implements toggle pattern (upsert/delete)
- [ ] #3 PrismaPostCommentRepository implements tree queries for nested comments
- [ ] #4 PrismaPostApprovalRequestRepository implements pending queue queries
- [ ] #5 PrismaCampusSettingRepository implements upsert pattern
- [ ] #6 All repositories use mappers for domain conversion
- [ ] #7 Proper field whitelisting for filter/sort operations
- [ ] #8 All repositories are @Injectable()
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create PrismaPostCategoryRepository in src/infra/persistence/prisma/repositories/:
   - Inject PrismaService, PrismaQueryService
   - findById: findUnique with id
   - findByCampusId: executeQuery with campus filter, include pagination
   - findByNameInCampus: findFirst with campusId + name
   - findActivesByCampusId: findMany with isActive=true, ordered by order
   - save: create with mapper
   - update: update with mapper
   - delete: delete by id
2. Create PrismaPostReactionRepository:
   - findByPostAndUser: findUnique with composite key
   - countByPost: count with postId filter
   - findUsersByPost: findMany select userId
   - save: create with mapper
   - delete: delete with composite key
3. Create PrismaPostCommentRepository:
   - findById: findUnique with user relation
   - findByPostId: executeQuery with postId filter, ordered by createdAt
   - findRootCommentsByPostId: findMany where parentCommentId=null
   - findRepliesByCommentId: findMany where parentCommentId=id
   - countByPost: count with postId and isDeleted=false
   - save: create with mapper
   - update: update with mapper
   - softDelete: update isDeleted=true, deletedAt, deletedById
4. Create PrismaPostApprovalRequestRepository:
   - findById: findUnique with submitter/reviewer relations
   - findByPostId: findMany ordered by submittedAt desc
   - findLatestByPostId: findFirst ordered by submittedAt desc
   - findPendingByCampus: join with Post, filter status=PENDING
   - save: create with mapper
   - update: update with mapper
5. Create PrismaCampusSettingRepository:
   - findByCampusId: findUnique
   - save: create (upsert pattern)
   - update: update
6. Add @Injectable() to all repositories
7. Export from index.ts
<!-- SECTION:PLAN:END -->

