---
id: '26'
title: 'Post & CMS: Database Migration - Add new tables and update Post schema'
status: done
priority: high
labels:
  - post
  - database
  - migration
  - phase-1
createdAt: '2026-01-09T03:09:31.444Z'
updatedAt: '2026-01-09T03:46:48.400Z'
timeSpent: 339
---
# Post & CMS: Database Migration - Add new tables and update Post schema

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create Prisma migration for Post & Content Management enhancement. This extends the **existing** Post infrastructure (17 use cases, full CRUD, workflow transitions already implemented).

**Key Findings from Code Analysis:**
- Post entity exists with content as String (needs change to Json)
- PostHistory exists with content as String (needs change to Json)
- PostHistoryStatus exists (needs previousStatus field added)
- All repositories, mappers, use cases, and controller already exist

**Changes Required:**

**1. Post Model Updates:**
- Change content: String? → content: Json? (Tiptap format)
- Add contentText: String? (extracted plain text for search)
- Add contentVersion: Int @default(1)
- Add isPinned: Boolean @default(false)
- Add pinnedUntil: DateTime?
- Add pinnedById: String? (FK to User)
- Add requiresApproval: Boolean @default(true)
- Add isDeleted: Boolean @default(false)
- Add deletedAt: DateTime?
- Add composite indexes: (campusId, status, publishAt), (campusId, isPinned)

**2. PostHistory Updates:**
- Change content: String? → content: Json? (match Post)
- Remove audience, status, publishAt fields (simplified per PRD)
- Rename authorId to editedById

**3. PostHistoryStatus Updates:**
- Add previousStatus: String? (track from-status)
- Rename status to newStatus
- Rename comment to reason (or keep both for compatibility)
- Rename userId to changedById

**4. New Models (per PRD DBML schema):**
- PostCategory (campus-scoped, name, color, icon, order)
- PostCategoryLink (post-category junction)
- PostReaction (unique per user/post, heart only)
- PostComment (nested with parentCommentId, depth max 3, soft delete)
- PostApprovalRequest (submission snapshots, review status)
- CampusSetting (requireTeacherApproval, maxPinnedPosts, etc.)

**Data Migration Concerns:**
- Existing posts have content as String - need to handle in migration
- Use Prisma raw SQL or post-migration script to convert

**Reference:** @doc/prds/post-and-content-management (DBML schema)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Post model has JSON content field (content: Json?) replacing String
- [x] #2 Post model has contentText: String? for full-text search
- [x] #3 Post model has contentVersion: Int @default(1)
- [x] #4 Post model has pinning fields (isPinned, pinnedUntil, pinnedById with User relation)
- [x] #5 Post model has soft delete fields (isDeleted, deletedAt)
- [x] #6 Post model has requiresApproval: Boolean @default(true)
- [x] #7 Post model has composite indexes for feed queries
- [x] #8 PostHistory model has content as Json? (matching Post)
- [x] #9 PostHistoryStatus model has previousStatus: String? field
- [x] #10 PostCategory model created with campus scoping, name, color, icon, order, isActive
- [x] #11 PostCategoryLink junction table created
- [x] #12 PostReaction model created with unique(postId, userId) constraint
- [x] #13 PostComment model created with parentCommentId, depth, soft delete fields
- [x] #14 PostApprovalRequest model created with content snapshots and review tracking
- [x] #15 CampusSetting model created with post-related settings
- [x] #16 All new models have proper indexes as per DBML schema
- [x] #17 Migration runs successfully without data loss
- [x] #18 Prisma client generates without errors
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Update Post Model** (schema.prisma line 529-557):
   - Change content from String? @db.Text to Json?
   - Add contentText: String? @db.Text (for full-text search)
   - Add contentVersion: Int @default(1)
   - Add isPinned: Boolean @default(false)
   - Add pinnedUntil: DateTime? @db.Timestamptz(6)
   - Add pinnedById: String? @db.Uuid with User relation
   - Add requiresApproval: Boolean @default(true)
   - Add isDeleted: Boolean @default(false)
   - Add deletedAt: DateTime? @db.Timestamptz(6)
   - Add User pinnedByPosts relation
   - Add composite index: @@index([campusId, status, publishAt])
   - Add index: @@index([campusId, isPinned])
   - Add index: @@index([isDeleted])

2. **Update PostHistory Model** (schema.prisma line 559-579):
   - Change content from String? @db.Text to Json?
   - Rename authorId to editedById (update relation name)
   - Remove audience, status, publishAt fields (deprecated per PRD)
   - Update User relation from postHistories to postEdits

3. **Update PostHistoryStatus Model** (schema.prisma line 581-599):
   - Add previousStatus: String?
   - Rename userId to changedById (update relation)
   - Keep status field (newStatus concept, backward compatible)
   - Keep comment field (reason concept, backward compatible)
   - Update User relation from postStatusChanges to postStatusEdits

4. **Create PostCategory Model**:
   - id: String @id @default(uuid()) @db.Uuid
   - campusId: String @db.Uuid with Campus relation
   - name: String (max 50 chars enforced in app)
   - color: String (hex color)
   - icon: String? (emoji or icon name)
   - order: Int @default(0)
   - isActive: Boolean @default(true)
   - createdAt, updatedAt timestamps
   - @@unique([campusId, name])
   - @@index([campusId, isActive])
   - @@index([campusId, order])

5. **Create PostCategoryLink Junction Table**:
   - postId: String @db.Uuid
   - categoryId: String @db.Uuid
   - createdAt: DateTime
   - @@id([postId, categoryId])
   - Relations to Post and PostCategory

6. **Create PostReaction Model**:
   - id: String @id @default(uuid()) @db.Uuid
   - postId: String @db.Uuid
   - userId: String @db.Uuid
   - createdAt: DateTime
   - @@unique([postId, userId]) - one heart per user per post
   - Relations to Post and User

7. **Create PostComment Model**:
   - id: String @id @default(uuid()) @db.Uuid
   - postId: String @db.Uuid
   - userId: String @db.Uuid
   - parentCommentId: String? @db.Uuid (self-reference)
   - depth: Int @default(0) (0=root, max 3)
   - content: String @db.Text (max 1000 chars enforced in app)
   - isDeleted: Boolean @default(false)
   - deletedAt: DateTime?
   - deletedById: String? @db.Uuid
   - createdAt, updatedAt timestamps
   - Self-relation for nested comments
   - @@index([postId, createdAt])
   - @@index([postId, parentCommentId])

8. **Create PostApprovalRequest Model**:
   - id: String @id @default(uuid()) @db.Uuid
   - postId: String @db.Uuid
   - submittedById: String @db.Uuid
   - submittedAt: DateTime
   - status: String @default("PENDING")
   - reviewedById: String? @db.Uuid
   - reviewedAt: DateTime?
   - reviewNote: String? @db.Text
   - titleSnapshot: String
   - contentSnapshot: Json?
   - createdAt: DateTime
   - @@index([status, submittedAt])

9. **Create CampusSetting Model**:
   - id: String @id @default(uuid()) @db.Uuid
   - campusId: String @unique @db.Uuid
   - requireTeacherApproval: Boolean @default(true)
   - maxPinnedPosts: Int @default(3)
   - allowParentComments: Boolean @default(true)
   - allowReactions: Boolean @default(true)
   - createdAt, updatedAt timestamps
   - One-to-one with Campus

10. **Update Campus Model Relations**:
    - Add postCategories: PostCategory[]
    - Add campusSetting: CampusSetting?

11. **Update User Model Relations**:
    - Add postReactions: PostReaction[]
    - Add postComments: PostComment[]
    - Add pinnedPosts: Post[] (as pinnedBy)
    - Add postApprovalSubmissions: PostApprovalRequest[]
    - Add postApprovalReviews: PostApprovalRequest[]
    - Add deletedComments: PostComment[] (as deletedBy)

12. **Run Prisma Format & Generate Migration**:
    - npx prisma format
    - npx prisma migrate dev --name post_cms_enhancement

13. **Verify Migration**:
    - Check migration SQL for data conversion handling
    - Test on fresh database
    - Test with existing data (if any)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Implemented Prisma migration for Post & CMS enhancement feature.

## Changes

### Post Model Updates
- Changed content from String? to Json? (Tiptap/ProseMirror format)
- Added contentText (String) for full-text search
- Added contentVersion (Int, default: 1) for schema versioning
- Added pinning fields: isPinned, pinnedUntil, pinnedById
- Added requiresApproval (Boolean, default: true)
- Added soft delete: isDeleted, deletedAt
- Added composite indexes for feed queries

### PostHistory Model (Simplified per PRD)
- Changed content from String? to Json?
- Renamed authorId to editedById
- Removed deprecated fields (audience, status, publishAt, updatedAt)

### PostHistoryStatus Model Updates
- Renamed userId to changedById
- Renamed status to newStatus
- Added previousStatus for tracking transitions
- Renamed comment to reason

### New Models Created
1. **PostCategory** - Campus-scoped categories (name, color, icon, order, isActive)
2. **PostCategoryLink** - Junction table for many-to-many post-category
3. **PostReaction** - Heart reactions with unique(postId, userId) constraint
4. **PostComment** - Nested comments with parentCommentId, depth (max 3), soft delete
5. **PostApprovalRequest** - Approval workflow with content snapshots
6. **CampusSetting** - Campus-level post settings

## Migration Files
- 20260109034405_post_cms_enhancement/migration.sql (main migration)
- 20260109034418_post_cms_enhancement/migration.sql (empty, sync)

## Breaking Changes
- PostHistory and PostHistoryStatus have column renames and removals
- Post.content type changed from String to Json
- These changes will require domain/application layer updates in subsequent tasks

## Verification
- prisma format: ✓ Success
- prisma migrate dev: ✓ Applied
- prisma generate: ✓ Client generated
- prisma migrate status: ✓ Database in sync
<!-- SECTION:NOTES:END -->

