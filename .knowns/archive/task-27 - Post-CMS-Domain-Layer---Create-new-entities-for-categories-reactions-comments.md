---
id: '27'
title: >-
  Post & CMS: Domain Layer - Create new entities for categories, reactions,
  comments
status: done
priority: high
labels:
  - post
  - domain
  - entity
  - phase-2
createdAt: '2026-01-09T03:10:07.570Z'
updatedAt: '2026-01-09T04:01:54.273Z'
timeSpent: 367
assignee: '@me'
---
# Post & CMS: Domain Layer - Create new entities for categories, reactions, comments

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create domain entities for the new Post & CMS features following existing codebase patterns.

**Context:**
- Follow Entity<Props> pattern from existing entities (see Staff, Guardian, Student)
- Use UniqueEntityID for entity IDs
- Include factory method create() with validation
- Include touch() for timestamp updates
- Reference: @doc/patterns/entity-pattern

**New Entities to Create:**
1. PostCategory - campus-scoped categories with name, color, icon, order
2. PostReaction - heart reactions (simplified, no type field needed)
3. PostComment - nested comments with parent_comment_id and depth
4. PostApprovalRequest - approval submissions with content snapshots
5. CampusSetting - campus-level configuration

**Update Existing:**
- Post entity: add content as JSON type, pinning methods, soft delete methods
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PostCategory entity created with props, getters, create(), update(), activate(), deactivate()
- [x] #2 PostReaction entity created with props, getters, create()
- [x] #3 PostComment entity created with props, getters, create(), update(), softDelete(), canReply() depth check
- [x] #4 PostApprovalRequest entity created with props, getters, create(), approve(), reject()
- [x] #5 CampusSetting entity created with props, getters, create(), update()
- [x] #6 Post entity updated with JSON content support and pinning methods
- [x] #7 All entities follow existing codebase patterns (Entity<Props>, UniqueEntityID)
- [x] #8 Domain enums created: ApprovalStatus (PENDING, APPROVED, REJECTED)
- [x] #9 Index file exports all new entities
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create ApprovalStatus enum in src/domain/content-management/enums/
   - Values: PENDING, APPROVED, REJECTED (for PostApprovalRequest status)
   - Export in enums/index.ts

2. Create PostCategory entity:
   - Props: campusId, name, color, icon, order, isActive, createdAt, updatedAt
   - Methods: updateInfo(), activate(), deactivate()
   - Validation: name required, color required, order >= 0

3. Create PostReaction entity:
   - Props: postId, userId, createdAt
   - Simple entity (heart-only, no update needed - just create/delete)

4. Create PostComment entity:
   - Props: postId, userId, parentCommentId, depth, content, isDeleted, deletedAt, deletedById, createdAt, updatedAt
   - Methods: updateContent(), softDelete(), canReply() - check depth < 3
   - Validation: content max 1000 chars, depth 0-3

5. Create PostApprovalRequest entity:
   - Props: postId, submittedById, submittedAt, status (ApprovalStatus), reviewedById, reviewedAt, reviewNote, titleSnapshot, contentSnapshot
   - Methods: approve(reviewerId, note), reject(reviewerId, note)

6. Create CampusSetting entity:
   - Props: campusId, requireTeacherApproval, maxPinnedPosts, allowParentComments, allowReactions, createdAt, updatedAt
   - Methods: update()

7. Update Post entity to match Prisma schema:
   - Add: campusId, contentText (for search), contentVersion
   - Change content to JSON type (rich text support)
   - Add: isPinned, pinnedUntil, pinnedById
   - Add: isDeleted, deletedAt, requiresApproval
   - Add methods: pin(), unpin(), softDelete(), restore()

8. Update index.ts exports for all new entities and enums
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Implemented domain layer entities for Post & CMS features following existing codebase patterns.

## Changes

### New Entities Created
- **PostCategory** (src/domain/content-management/entities/post-category.entity.ts)
  - Props: campusId, name, color, icon, order, isActive, timestamps
  - Methods: updateInfo(), activate(), deactivate()
  - Validation: name required, hex color format, order >= 0

- **PostReaction** (src/domain/content-management/entities/post-reaction.entity.ts)
  - Props: postId, userId, createdAt
  - Simple entity for heart-only reactions (toggle via create/delete)

- **PostComment** (src/domain/content-management/entities/post-comment.entity.ts)
  - Props: postId, userId, parentCommentId, depth, content, soft delete fields
  - Methods: updateContent(), softDelete(), canReply()
  - Constants: MAX_COMMENT_DEPTH (3), MAX_COMMENT_LENGTH (1000)
  - Supports nested comments with depth validation

- **PostApprovalRequest** (src/domain/content-management/entities/post-approval-request.entity.ts)
  - Props: postId, submitter info, reviewer info, snapshots
  - Methods: approve(reviewerId, note), reject(reviewerId, note)
  - Tracks content snapshots for audit

- **CampusSetting** (src/domain/content-management/entities/campus-setting.entity.ts)
  - Props: campusId, requireTeacherApproval, maxPinnedPosts, comment/reaction toggles
  - Methods: update(), enable/disable methods for each setting

### New Enum Created
- **ApprovalStatus** (src/domain/content-management/enums/approval-status.enum.ts)
  - Values: PENDING, APPROVED, REJECTED

### Updated Entities
- **Post** entity updated with:
  - campusId (required campus scoping)
  - JSON content type (PostContent) with contentText for search
  - contentVersion for tracking edits
  - Pinning: isPinned, pinnedUntil, pinnedById, pin(), unpin(), isPinExpired()
  - Soft delete: isDeleted, deletedAt, softDelete(), restore()
  - requiresApproval flag
  - Helper methods: canEdit(), canReceiveEngagement()
  - MAX_POST_TITLE_LENGTH constant (200)

### Index Updated
- All new entities and enums exported from src/domain/content-management/index.ts

## Notes
- Application layer use cases will need updates to work with new Post entity structure (campusId required, PostContent type)
- All entities follow Entity<Props> pattern with UniqueEntityID
- Validation included in create() factory methods
<!-- SECTION:NOTES:END -->

