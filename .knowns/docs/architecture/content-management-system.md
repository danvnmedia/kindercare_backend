---
title: Content Management System
description: 'Post lifecycle: status state-machine, audience targeting, attachments, approval workflow, comments, reactions, pinning, and the campus settings switchboard'
createdAt: '2026-05-05T17:47:17.286Z'
updatedAt: '2026-07-01T00:00:00.000Z'
tags:
  - architecture
  - content-management
  - post
  - approval
  - moderation
  - campus
---

# Content Management System

> The Posts subsystem (a Facebook-style feed for kindergarten communications). Source under `src/domain/content-management/`, `src/application/content-management/`, controllers at `src/infra/http/controllers/post.controller.ts`, `comment.controller.ts`, `post-category.controller.ts`, `campus-setting.controller.ts`.

## Aggregates

```
Post (campus-scoped)
├── PostAudience[]      — class | "all"
├── Attachment[]        — File references with display order
├── PostHistory[]       — every edit (title + content snapshot)
├── PostHistoryStatus[] — every status transition (audit trail)
├── PostReaction[]      — heart reactions (one per user)
├── PostComment[]       — nested comments with depth
├── PostApprovalRequest[] — moderation snapshots
└── PostCategoryLink[]  — many-to-many to PostCategory

CampusSetting (1:1 with Campus)
PostCategory (campus-scoped, ordered, archivable)
```

The aggregate root is `Post`; its lifecycle drives nearly every related table.

## Post Status State Machine

`PostStatus` (`src/domain/content-management/enums/post-status.enum.ts`):

```
DRAFT → PENDING_REVIEW → PUBLISHED → ARCHIVED
   ↑ ←─────── (REJECT) ─┘
   ↓
ARCHIVED
```

Allowed transitions are encoded on the entity:

| From | Method | To | Permitted by |
|------|--------|-----|--------------|
| `DRAFT` | `submitForReview()` | `PENDING_REVIEW` | Author |
| `DRAFT` | `publish()` | `PUBLISHED` | Author (only when `requireTeacherApproval = false`) |
| `PENDING_REVIEW` | `approve(publishAt?)` | `PUBLISHED` | System role / admin |
| `PENDING_REVIEW` | `reject()` | `DRAFT` | System role / admin |
| `PUBLISHED`/`DRAFT` | `archive()` | `ARCHIVED` | Author or admin |
| `PUBLISHED`/`PENDING_REVIEW` | `moveToDraft()` (revise) | `DRAFT` | Author |
| any | `softDelete()` | (sets `isDeleted`) | Author or admin |

The entity throws on illegal transitions, e.g. `Cannot publish post with status PENDING_REVIEW`.

### `TransitionPostUseCase` — the dispatcher

The HTTP layer exposes one transition endpoint (`POST /posts/:id/transition`) backed by `TransitionPostUseCase`, which dispatches to the per-action use case:

```typescript
switch (action) {
  case PostTransitionAction.APPROVE: return this.approvePostUseCase.execute(...);
  case PostTransitionAction.REJECT:  return this.rejectPostUseCase.execute(...);
  case PostTransitionAction.PUBLISH: return this.publishPostUseCase.execute(...);
  case PostTransitionAction.REVISE:  return this.revisePostUseCase.execute(...);
  case PostTransitionAction.SUBMIT:  return this.submitForReviewUseCase.execute(...);
  case PostTransitionAction.ARCHIVE: return this.archivePostUseCase.execute(...);
}
```

Each use case:

1. Loads the post.
2. Checks campus and authorization (author vs. admin via `currentUser.hasSystemRole()`).
3. Calls the entity transition method.
4. Persists.
5. Writes a `PostHistoryStatus` row (`previousStatus`, `newStatus`, `changedById`).
6. For `submit`, also writes a `PostApprovalRequest` snapshot.
7. For `approve`, marks the latest pending `PostApprovalRequest` as approved.

## Approval Workflow

Approval is **conditional** on `CampusSetting.requireTeacherApproval`. The setting defaults to `true`.

```typescript
// SubmitForReviewUseCase
const setting = await this.campusSettingRepository.findByCampusId(post.campusId);
const requiresApproval = setting?.requireTeacherApproval ?? true;

if (!requiresApproval) {
  post.publish();                              // skip review, go straight to PUBLISHED
  // … write history with newStatus = PUBLISHED
  return updatedPost;
}

post.submitForReview();
// … write history with newStatus = PENDING_REVIEW
// … create PostApprovalRequest with title/content snapshot
```

`PostApprovalRequest` is the **append-only audit trail**. Each submission creates a new row; approvals/rejections update the row's `status`, `reviewedById`, `reviewedAt`, `reviewNote`. Snapshots (`titleSnapshot`, `contentSnapshot`) capture content **at submission time** so admins reviewing later see what was actually submitted, not whatever the post drifted to.

## Authorization Model for Posts

| Action | Who can do it |
|--------|---------------|
| Create / update / delete own post | Author (post.authorId === user.id) |
| Approve / reject pending posts | `currentUser.hasSystemRole()` (global admin bypass) |
| Pin / unpin | `@Roles("Admin")` (i.e. role-name based) |
| Add / remove attachment | Author or admin |
| Comment | Anyone with `post.read` permission and `allowParentComments` campus setting |
| React | Anyone with engagement permission and `allowReactions` campus setting |

The mix of `hasSystemRole` (Post controller) and `@Roles("Admin")` (pin/unpin) is historical — both work, but new code should standardise on permissions (see [@doc/architecture/rbac-system](architecture/rbac-system)).

## Audiences

Each `Post` has at least one `PostAudience` row. The `AudienceType` enum determines the targeting:

| Type | Targets |
|------|---------|
| `ALL` | Every user in the campus |
| `CLASS` | All members of `classId` |

`CreatePostUseCase` calls `validateAudiencesBelongToCampus(audiences, campusId, repos)` (`src/application/content-management/utils/`) to ensure every targeted class is in the same campus as the post — preventing cross-campus posting.

Read visibility is audience-aware for parent/guardian users:

- Staff/admin users keep normal campus-scoped feed visibility.
- `ALL` posts are visible to every authenticated user with campus access.
- `CLASS` posts are visible to a guardian only when one of their linked children has an active enrollment (`endDate = null`) in the target class.
- `GET /posts` and `GET /posts/:id` both route through repository visibility filters so list/detail behavior stays consistent.

CMS `AudienceType` now exposes only `ALL` and `CLASS`; legacy `GRADE` and `STUDENT` post-audience DB columns were removed by migration `20260701001000_remove_grade_student_post_audience` after deleting legacy rows of those types.

This filtering currently lives in `PrismaPostRepository.buildViewerVisibilityWhere()` and is called by `findMany(..., viewer)` and `findVisibleById(id, campusId, viewer)`.

## Content Format

`Post.content` is `Json?` in Prisma — Tiptap/ProseMirror rich-text JSON in practice. The entity also stores `contentText` (plain text) for full-text search, and `contentVersion: Int` which increments on every `updateContent`/`updateTitle`.

```typescript
// CreatePostUseCase
const contentText = input.content ? extractTextFromTiptap(input.content) : null;
```

`extractTextFromTiptap` walks the JSON tree and concatenates all `text` nodes, giving a plain-text rendering for search filters.

## Attachments

`Attachment` rows reference `File` rows. The relationship has an `order: Int` for display sequence. `AddAttachmentUseCase`:

1. Fetches the post (must be in same campus, must allow edit).
2. Fetches the file (must be in same campus, `isAvailable()` — uploaded/processed and not deleted).
3. Rejects duplicate file attachments on the same post; DB also enforces `@@unique([postId, fileId])` for concurrent requests.
4. Creates the attachment with `order: 0`; `AttachmentRepository.appendToPost()` owns transactional append/order behavior under a post row lock.

File upload/storage details live in @doc/architecture/file-management-and-storage. Upload is a universal campus-scoped primitive: `campusId` is always required, audience context is optional, and only `ALL`/omitted or `CLASS + audienceId` storage grouping is supported. CMS post visibility is enforced by `PostAudience`, not by file upload metadata.

`AttachmentRepository.findByPostId()` returns attachments ordered by `order asc`. `ReorderAttachmentsUseCase` updates the `order` column for the supplied IDs in a transaction; append/remove/reorder lock the post row and use two-phase temp ordering to avoid `@@unique([postId, order])` swap conflicts.

## Comments

`PostComment` supports nested replies via `parentCommentId` and tracks `depth: Int`. Soft-deleted comments (`isDeleted`, `deletedAt`, `deletedById`) preserve thread structure — the UI typically shows "Comment removed" placeholders.

| Use case | Endpoint | Notes |
|----------|----------|-------|
| `CreatePostCommentUseCase` | `POST /posts/:id/comments` | depth = 0 |
| `CreateCommentReplyUseCase` | `POST /posts/:postId/comments/:commentId/replies` | depth = parent.depth + 1 |
| `UpdatePostCommentUseCase` | `PATCH /posts/:postId/comments/:id` | author only |
| `DeletePostCommentUseCase` | `DELETE /posts/:postId/comments/:id` | author or admin (sets `isDeleted` + `deletedById`) |
| `GetPostCommentsUseCase` | `GET /posts/:id/comments` | paginated, with replies |

## Reactions

Heart reactions only (single emoji), one per user. `TogglePostReactionUseCase` atomically inserts or deletes the row and returns the new total + user's state.

## Pinning

`Post.isPinned`, `pinnedUntil`, `pinnedById` track pins. The campus setting `maxPinnedPosts` (default 3) caps the number of currently-pinned posts; `PinPostUseCase` enforces this. Pins can have an optional expiry; `Post.isPinExpired()` is checked on read.

`Post.softDelete()` automatically calls `unpin()` to keep the pin list consistent.

## Campus Settings (`CampusSetting`)

A 1:1 row per campus that controls feature flags:

```prisma
model CampusSetting {
  campusId               String  @unique @db.Uuid
  requireTeacherApproval Boolean @default(true)
  maxPinnedPosts         Int     @default(3)
  allowParentComments    Boolean @default(true)
  allowReactions         Boolean @default(true)
}
```

Used by:

- `SubmitForReviewUseCase` → `requireTeacherApproval`
- `PinPostUseCase` → `maxPinnedPosts`
- `CreatePostCommentUseCase` → `allowParentComments`
- `TogglePostReactionUseCase` → `allowReactions`

If no row exists, the use cases default to permissive values (`?? true`). Admins manage via `GET /campus-settings` and `PATCH /campus-settings`.

## Categories

`PostCategory` entities are campus-scoped, ordered, and archivable. Posts are linked via `PostCategoryLink` (many-to-many). `ReorderPostCategoriesUseCase` allows admin drag-and-drop ordering.

## Module Wiring

`ContentManagementModule` (`src/infra/http/modules/content-management.module.ts`) imports:

```typescript
imports: [
  PrismaModule,
  ClerkModule,
  StandardResponseModule,
  AuthModule,                  // for ClerkAuthGuard, RequestContext
  UserManagementModule,        // for USER_REPOSITORY
  ClassManagementModule,       // for CLASS_REPOSITORY
  FileManagementModule,        // for FILE_REPOSITORY (attachments)
  CampusModule,                // for CAMPUS_REPOSITORY (CampusGuard)
],
```

Exports the eight content-related repositories so other modules (e.g. attendance for image attachments) can read posts.

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Forgetting to write a `PostHistoryStatus` row on transition | Audit trail incomplete |
| Reading author identity from `request.user` instead of taking `currentUser` as a use case argument | Use cases become hard to test |
| Trusting `dto.campusId` in `CreatePostInput` | Cross-campus targeting; always override with `@CampusContext()` |
| Returning soft-deleted posts in the feed | Use a `where: { isDeleted: false }` scope on list endpoints |
| Skipping `validateAudiencesBelongToCampus` | Cross-campus broadcasting becomes possible |
| Forgetting to invalidate pin when soft-deleting | `Post.softDelete()` already handles this — keep relying on it |
| Assigning `requiresApproval = false` per-post via API | The setting is per-campus; per-post override would bypass moderation |

## Reference

| File | Notes |
|------|-------|
| `src/domain/content-management/entities/post.entity.ts` | The state machine + soft-delete logic |
| `src/domain/content-management/enums/post-status.enum.ts` | DRAFT / PENDING_REVIEW / APPROVED / PUBLISHED / REJECTED / ARCHIVED |
| `src/application/content-management/use-cases/transition-post.use-case.ts` | Action dispatcher |
| `src/application/content-management/use-cases/submit-for-review.use-case.ts` | Approval branching + history |
| `src/application/content-management/use-cases/approve-post.use-case.ts` | Admin approval path |
| `src/application/content-management/use-cases/pin/pin-post.use-case.ts` | Cap enforcement via `CampusSetting.maxPinnedPosts` |
| `src/application/content-management/utils/extract-text-from-tiptap.ts` | Plain-text extraction |
| `src/application/content-management/utils/index.ts` | `validateAudiencesBelongToCampus` |
| `prisma/schema.prisma` | All content-management tables |


## CMS Backend Audit Consolidation 2026-07-01

Consolidated from loose root docs `CMS-backend.md` and `CMS-backend-fix-refactor-plan.md`.

### Production Readiness Status

CMS backend is partially production-ready. P0 build blockers and core state-machine issues were fixed; remaining work is mostly E2E coverage and lower-volume mutation audit hardening.

Completed fixes:

- Prisma `File` schema/client now aligns with file mapper/domain context fields: `purpose`, `audienceType`, `audienceId`, `classId`, `gradeLevelId`.
- Persistent post statuses are limited to `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, and `ARCHIVED`; approval/rejection are approval-request/history actions, not post statuses.
- Approval flow: approve publishes; reject returns to draft while approval request records `REJECTED`.
- Pin/unpin role casing normalized to `admin` and `super_admin`.
- Public comment routes require campus access.
- Comment/reply creation enforces post campus ownership, `allowParentComments`, and post engagement eligibility.
- Reaction toggle/status enforce post campus ownership, `allowReactions`, and post engagement eligibility.
- Category FE compatibility added: response exposes `isActive`; `isActive` filters map to inverse `isArchived`.
- Post repository default list/read visibility excludes `isDeleted`; delete soft-deletes and clears pin fields.
- Post repository parent/guardian read visibility filters `ALL` posts to the whole campus and `CLASS` posts to guardians whose linked children are actively enrolled in the selected class.
- Category reorder runs in a transaction and enforces campus ownership per row.
- Attachment add/remove/reorder hardening added: duplicate file attach rejection plus DB `@@unique([postId, fileId])`, transaction-scoped append/remove/order compaction, post row locks for ordering mutations, duplicate/foreign/missing ID rejection, nonnegative contiguous order validation, ordered attachment reads, and two-phase temp ordering to avoid `@@unique([postId, order])` swap conflicts.
- CMS UoW/audit infrastructure added for core admin CRUD, post categories, campus CMS settings, audit target snapshots, and transaction ops.

### Remaining CMS Follow-ups

- Full CMS E2E suite is still missing; no existing CMS E2E/spec pattern was found to extend.
- Add E2E coverage for cross-campus denial and settings-disabled cases across comments, reactions, attachments, pinning, categories, and status workflows.
- Introduce canonical role constants/enums or central role normalization so role string drift does not recur.
- Continue lower-volume mutation audits for comments/reactions/attachments/pin workflow if product requires complete audit coverage beyond admin CRUD/status/category/settings.

### Validation History

Known completed validation from loose docs:

- `npm run prisma:generate` passed after File schema alignment.
- `npm run build` passed after CMS fixes.
- `npm test -- role-user-dedup --runInBand` completed without error output and confirmed dedup behavior.
[32m[Nest] 15988  - [39m05:29:35 01/07/2026 [32m    LOG[39m [38;5;3m[AssignUsersToRoleUseCase] [39m[32mGranting role role-1 to 2 user(s) in campus campus-1[39m
[32m[Nest] 15988  - [39m05:29:35 01/07/2026 [32m    LOG[39m [38;5;3m[AssignUsersToRoleUseCase] [39m[32mGranted role role-1 to user user-1 in campus campus-1[39m
[32m[Nest] 15988  - [39m05:29:35 01/07/2026 [32m    LOG[39m [38;5;3m[AssignUsersToRoleUseCase] [39m[32mGranted role role-1 to user user-2 in campus campus-1[39m
[32m[Nest] 15988  - [39m05:29:35 01/07/2026 [32m    LOG[39m [38;5;3m[RemoveUsersFromRoleUseCase] [39m[32mRevoking role role-1 from 2 user(s) in campus campus-1[39m
[32m[Nest] 15988  - [39m05:29:35 01/07/2026 [32m    LOG[39m [38;5;3m[RemoveUsersFromRoleUseCase] [39m[32mRevoked role role-1 from user user-1 in campus campus-1[39m
[32m[Nest] 15988  - [39m05:29:35 01/07/2026 [32m    LOG[39m [38;5;3m[RemoveUsersFromRoleUseCase] [39m[32mRevoked role role-1 from user user-2 in campus campus-1[39m completed without error output and confirmed dedup behavior.
