---
title: Content Management System
description: 'Post lifecycle: status state-machine, audience targeting, attachments, approval workflow, comments, reactions, pinning, and the campus settings switchboard'
createdAt: '2026-05-05T17:47:17.286Z'
updatedAt: '2026-05-05T17:47:17.286Z'
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
├── PostAudience[]      — class | grade-level | student | "all"
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
| `GRADE_LEVEL` | All students/guardians at that grade |
| `STUDENT` | A specific student (and their guardians) |

`CreatePostUseCase` calls `validateAudiencesBelongToCampus(audiences, campusId, repos)` (`src/application/content-management/utils/`) to ensure every targeted entity is in the same campus as the post — preventing cross-campus posting.

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
2. Fetches the file (must be in same campus, `isAvailable()` — uploaded and not deleted).
3. Computes `nextOrder = max(existingOrder) + 1`.
4. Creates the attachment.

`ReorderAttachmentsUseCase` updates the `order` column for the supplied IDs, in a transaction.

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
  UserManagementModule,        // for USER_REPOSITORY, STUDENT_REPOSITORY
  ClassManagementModule,       // for CLASS_REPOSITORY, GRADE_LEVEL_REPOSITORY
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
