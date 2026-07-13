---
title: Content Management System
description: 'Post lifecycle: status state-machine, audience targeting, attachments, approval workflow, comments, reactions, pinning, and the campus settings switchboard'
createdAt: '2026-05-05T17:47:17.286Z'
updatedAt: '2026-07-12T05:39:54.717Z'
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

The HTTP layer exposes a single-post transition endpoint (`POST /posts/:id/transition`) backed by `TransitionPostUseCase`, which dispatches to the per-action use case:

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

`POST /posts/batch-transition` wraps the same dispatcher for up to 100 post IDs. It de-duplicates IDs, processes each post through `TransitionPostUseCase`, and returns per-post results with `total`, `succeeded`, `failed`, and `results[]`. Batch transition is intentionally partial-success: one invalid or unauthorized post does not roll back successful transitions. Use it for management bulk approve flows so frontend code can show progress and failed rows without issuing N unrelated requests.

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
- `GET /posts`, `GET /posts/:id`, and `GET /posts/pinned` route through repository visibility filters so list/detail/pinned behavior stays consistent.

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


## CMS cross-repository validation batch 1 — 2026-07-12

Status: blocked.

Parallel audits compared backend CMS routes, DTOs, serializers, categories, child resources, permissions, and frontend consumers.

Release-blocking findings:

- Single post transition accepts post.review for submit, revise, publish, and archive. Action-specific authorization must require post.update for update-class transitions and post.review for approve or reject.
- Public reply creation accepts management-comment parent IDs because parent comment type is not checked.
- Deleted public comment responses preserve original content instead of masking it.
- Embedded post attachment responses do not reliably include file URLs.
- File deletion permits destructive campus-wide deletion for file.delete holders and does not reject files referenced by post attachments.
- Upload completion and stale-upload cleanup can race on PENDING state.

Important follow-ups:

- Restore category flow is absent despite domain unarchive support. Category pin, default, and usage-count capabilities are absent end to end.
- Frontend pinning is incomplete; only unpin is wired and cache reconciliation is missing.
- Frontend reply depth allows one level beyond backend rules.
- Comment pagination newest ordering, comment length guards, archive cache updates, direct CMS route gates, and create-versus-list permission assumptions need correction.

Validation evidence reported by parallel reviewers: backend build passed; targeted suites passed in independent groups, including 23 suites and 199 tests, 14 suites and 146 tests, and RBAC 7 suites and 125 tests. Frontend TypeScript and targeted ESLint passed, with one existing campus-provider hooks warning. These passing tests do not cover the blockers above.


## CMS executable validation batch 2 — 2026-07-12

Status: blocked despite successful compilation.

Backend validation:

- npm run build passed.
- Full unit suite: 215 suites passed, 1 failed; 1832 tests passed, 1 failed, 1 skipped. Failure is src/cli/export-audit-actions.spec.ts because the assertion expects 55 actions while the export now returns 70. This is not CMS-specific, but prevents a green repository suite.
- E2E ran zero tests because test/jest-e2e.json is missing.
- Knowns docs validation passed structurally with 53 informational missing-reference findings.
- Knowns SDD validation passed structurally with the same 53 informational findings.

Passing targeted CMS suites from batch 1 do not cover the release blockers recorded above.


## CMS independent release review batch 3 — 2026-07-12

Verdict: blocked. Independent adversarial review confirmed all six batch-1 release blockers. Narrow regression suites passed but do not exercise these failures.

Additional common-flow blockers:

- Future-scheduled posts become PUBLISHED and visible before publishAt because public visibility checks status without requiring publishAt less than or equal to the current time.
- post.manage does not authorize deletion of another author comment in the public moderation use case, despite the compressed permission handoff promising moderation capability.

Upload happy-path calibration:

- Selected campus header, initiate-upload body, direct R2 PUT, completion, post create or update, attachment add, reorder, and retry payloads align.
- The flow is not release-ready because a refetched post attachment lacks a backend-resolved file URL, causing frontend image and download consumers to omit it.

Must-fix order:

1. Resolve attachment read URLs in every embedded PostResponse.
2. Enforce scheduled visibility using publishAt.
3. Separate transition permissions by action.
4. Reject public replies to non-public parents and mask deleted content.
5. Correct file owner versus elevated deletion and reject attached-file deletion.
6. Make upload completion and cleanup state transitions atomic.
7. Include post.manage in public comment moderation.

Live R2, CORS, CSP, migration, seeded role assignment, and DB concurrency validation remain unexecuted.


## CMS release hardening implementation wave 1 — 2026-07-12

Implemented:

- Public visibility and engagement now require publishAt to be absent or due.
- Single and batch transitions enforce action-specific permissions: approve/reject use post.review; submit/revise/publish/archive use post.update; post.manage remains implied.
- post.manage now supports campus-scoped public-comment moderation.
- Public replies reject non-public parent comments.
- Deleted comment content is masked as [deleted] at the response boundary while persisted audit content remains unchanged.

Validation: combined targeted backend run passed 13 suites and 143 tests; backend build passed. Independent post/RBAC and comment privacy reviews found no P1/P2/P3 findings.


## CMS release hardening final closeout — 2026-07-12

Release-hardening AC-8 through AC-13 are implemented and checked. Cross-campus review confirmed unpublished visibility cannot be broadened by a system role assigned in another campus. Targeted CMS/security tests and build pass.

Repository-wide backend unit validation retains one unrelated stale export-audit-actions count assertion: expected 55, actual 70. E2E remains unavailable because test/jest-e2e.json is absent. These are repository validation gaps, not failures in the changed CMS suites.
