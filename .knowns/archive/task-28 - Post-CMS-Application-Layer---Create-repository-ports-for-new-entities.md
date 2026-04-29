---
id: '28'
title: 'Post & CMS: Application Layer - Create repository ports for new entities'
status: done
priority: high
labels:
  - post
  - application
  - repository
  - phase-2
createdAt: '2026-01-09T03:10:09.487Z'
updatedAt: '2026-01-09T16:52:44.306Z'
timeSpent: 112
---
# Post & CMS: Application Layer - Create repository ports for new entities

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create abstract repository port classes for the new Post & CMS entities following existing patterns.

**Context:**
- Follow abstract class pattern from existing repos (see StaffRepository, GuardianRepository)
- Include standard CRUD methods plus domain-specific queries
- Support pagination via StandardRequest/PaginatedResult
- Reference: @doc/patterns/repository-pattern

**Ports to Create:**
1. PostCategoryRepository - CRUD + findByCampusId, findByName
2. PostReactionRepository - toggle pattern (create/delete), count by post
3. PostCommentRepository - CRUD + findByPostId (tree structure), findReplies
4. PostApprovalRequestRepository - CRUD + findPendingByPost, findPendingByCampus
5. CampusSettingRepository - findByCampusId, upsert pattern
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PostCategoryRepository port created with findAll, findById, findByCampusId, findByNameInCampus, save, update, delete
- [ ] #2 PostReactionRepository port created with findByPostAndUser, countByPost, save, delete
- [ ] #3 PostCommentRepository port created with findById, findByPostId, findRepliesByCommentId, save, update, softDelete
- [ ] #4 PostApprovalRequestRepository port created with findById, findByPostId, findPendingByCampus, save, update
- [ ] #5 CampusSettingRepository port created with findByCampusId, save, update
- [ ] #6 All ports follow abstract class pattern
- [ ] #7 Pagination support where applicable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create PostCategoryRepository in src/application/content-management/ports/:
   - findById(id): Promise<PostCategory | null>
   - findByCampusId(campusId, params): Promise<PaginatedResult<PostCategory>>
   - findByNameInCampus(campusId, name): Promise<PostCategory | null>
   - findActivesByCampusId(campusId): Promise<PostCategory[]>
   - save(category): Promise<PostCategory>
   - update(category): Promise<PostCategory>
   - delete(id): Promise<void>
2. Create PostReactionRepository:
   - findByPostAndUser(postId, userId): Promise<PostReaction | null>
   - countByPost(postId): Promise<number>
   - findUsersByPost(postId): Promise<string[]>
   - save(reaction): Promise<PostReaction>
   - delete(postId, userId): Promise<void>
3. Create PostCommentRepository:
   - findById(id): Promise<PostComment | null>
   - findByPostId(postId, params): Promise<PaginatedResult<PostComment>>
   - findRootCommentsByPostId(postId): Promise<PostComment[]>
   - findRepliesByCommentId(commentId): Promise<PostComment[]>
   - countByPost(postId): Promise<number>
   - save(comment): Promise<PostComment>
   - update(comment): Promise<PostComment>
   - softDelete(id, deletedById): Promise<void>
4. Create PostApprovalRequestRepository:
   - findById(id): Promise<PostApprovalRequest | null>
   - findByPostId(postId): Promise<PostApprovalRequest[]>
   - findLatestByPostId(postId): Promise<PostApprovalRequest | null>
   - findPendingByCampus(campusId, params): Promise<PaginatedResult<PostApprovalRequest>>
   - save(request): Promise<PostApprovalRequest>
   - update(request): Promise<PostApprovalRequest>
5. Create CampusSettingRepository:
   - findByCampusId(campusId): Promise<CampusSetting | null>
   - save(setting): Promise<CampusSetting>
   - update(setting): Promise<CampusSetting>
6. Export all from index.ts
<!-- SECTION:PLAN:END -->

