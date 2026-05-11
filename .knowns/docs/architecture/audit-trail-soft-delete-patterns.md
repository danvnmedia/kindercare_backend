---
title: 'Audit Trail & Soft Delete Patterns'
description: Audit timestamps, audit user fields, isArchived vs isDeleted+deletedAt, history tables, and Clerk identity locking
createdAt: '2026-05-05T17:44:33.648Z'
updatedAt: '2026-05-05T17:44:33.648Z'
tags:
  - architecture
  - audit
  - soft-delete
  - history
  - lifecycle
---

# Audit Trail & Soft Delete Patterns

> The codebase has **two soft-delete styles** and a few audit conventions. Picking the wrong one for a new entity is a common mistake — this doc covers when to use which.

## Audit Timestamps (Universal)

Every persisted entity has:

| Column | Prisma | Purpose |
|--------|--------|---------|
| `createdAt` | `DateTime @default(now()) @db.Timestamptz(6)` | When the row was inserted |
| `updatedAt` | `DateTime @updatedAt @db.Timestamptz(6)` | Last write |

Domain entities mirror these as `Date` props. Mutations call `this.touch()` to update `updatedAt` from inside the entity, so the value is set even if Prisma's `@updatedAt` doesn't fire (it depends on the write being a Prisma `update`, not a raw query).

## Audit User Fields (Selective)

Some entities track **who** performed an action. There is no global "audited by" pattern; it's added per-entity when relevant:

| Entity | Field | What it means |
|--------|-------|---------------|
| `StudentAttendanceSummary` | `updatedById: String? @db.Uuid` | The user who last updated the day's status |
| `StudentAttendanceLog` | `createdById: String? @db.Uuid` | The teacher/staff who recorded the check-in/out |
| `Post.pinnedById` | `String? @db.Uuid` | Who pinned the post |
| `PostComment.deletedById` | `String? @db.Uuid` | Who soft-deleted the comment (could be author or moderator) |
| `PostHistoryStatus.changedById` | `String @db.Uuid` (required) | Status transition author |
| `PostHistory.editedById` | `String @db.Uuid` (required) | Who edited the post (each edit is a row) |
| `PostApprovalRequest.submittedById/reviewedById` | `String @db.Uuid` | Workflow actors |

These fields use `onDelete: SetNull` for optional ones and `onDelete: Restrict` for required ones — never `Cascade`, because we don't want deleting a user to cascade through audit history.

> Use case methods take the actor as `currentUser: User` and pass `currentUser.id` into the audit field. Don't read the actor from `RequestContext` inside the use case — the controller is the boundary that injects it explicitly.

## Soft Delete: `isArchived` (Recoverable)

The default for **operational entities** that may be re-activated.

```prisma
model Student {
  // …
  isArchived Boolean @default(false) @map("is_archived")
  @@index([isArchived])
}
```

| Trait | Behaviour |
|-------|-----------|
| Domain method | `entity.archive()` and `entity.restore()` |
| List queries | Caller usually passes `isArchived: false`; archived rows are still queryable |
| Use case | A `DELETE` HTTP endpoint maps to `archive()`; a `PATCH /:id/restore` maps to `restore()` |
| Hard delete | Lives in `DangerXxxController` for admin use |
| Clerk identity | `archive` calls `lockIdentity` (best-effort) so the user can't sign in; `restore` calls `unlockIdentity` |
| Status reset | Some entities (Student) also reset their lifecycle status — `archive()` sets `status = DROPPED`, `restore()` sets `status = ACTIVE` |

Used by: `Student`, `Staff`, `Guardian`, `Class`, `GradeLevel`, `SchoolYear`, `StaffType`, `GuardianRelationship`, `PostCategory`, `Campus`, `File` (alongside `isDeleted`), `Subject` (no archive flag — true delete), `Role` (no flag).

## Soft Delete: `isDeleted` + `deletedAt` (Audit Trail)

Used for **content** where the row is rarely restored but must remain queryable for moderation, history, and audit.

```prisma
model Post {
  // …
  isDeleted Boolean   @default(false) @map("is_deleted")
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)
  @@index([isDeleted])
}

model PostComment {
  isDeleted   Boolean   @default(false) @map("is_deleted")
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(6)
  deletedById String?   @map("deleted_by_id") @db.Uuid
}
```

| Trait | Behaviour |
|-------|-----------|
| Domain method | `entity.softDelete()` (and rarely `restore()`) |
| List queries | Default queries **exclude** soft-deleted rows |
| Side effects | `softDelete()` may cascade — e.g. `Post.softDelete()` calls `unpin()` first |
| Audit attribution | Optional `deletedById` records who deleted it |

Used by: `Post`, `PostComment`, `File`.

## Why Two Patterns?

The split reflects two different motivations:

| Concern | Use `isArchived` | Use `isDeleted + deletedAt` |
|---------|-------------------|------------------------------|
| User can re-enrol / re-hire / re-link | ✓ | |
| Visible in admin lists by default | ✓ | |
| Need a permanent timestamp for audit | | ✓ |
| Cascade implications on delete | minimal | significant (need to unpin, prevent further engagement) |
| Domain treats absence vs archived differently | absence = doesn't exist; archived = on hold | absence = doesn't exist; deleted = once existed, now gone |

## Hard Delete (`DangerXxxController`)

Hard deletes go through a separate controller and are guarded by an explicit permission. They:

- Bypass `isArchived` / `isDeleted` and remove the row.
- Trigger `onDelete` cascades / restrictions in Prisma.
- For identity-linked entities, also delete the Clerk user (no compensation — destructive). See [@doc/patterns/saga-pattern](patterns/saga-pattern).

```typescript
// DangerStudentController
@Delete(":id")
@Permissions("student.delete")
async destroy(@Param("id") id: string, @CampusContext() campusId: string) {
  await this.deleteStudentUseCase.execute(id, campusId);
}
```

## Append-Only History Tables

Some workflows need a full event log, not just the latest state. The pattern is a separate **history** table with one row per state transition:

| History table | Recorded events |
|---------------|------------------|
| `PostHistory` | One row per content edit (title + content snapshot, `editedById`, timestamp) |
| `PostHistoryStatus` | One row per status transition (`previousStatus`, `newStatus`, `changedById`, optional `reason`) |
| `PostApprovalRequest` | One row per `SubmitForReview` action with snapshot of title/content (`submittedById`, `reviewedById`, status) |

Conventions:

- **Append-only**: history rows are inserted, never updated.
- **No `updatedAt`** — only `createdAt`.
- Foreign keys to actors use `onDelete: Restrict` so deleting a user can't orphan history.
- The use case writes the history row in the **same transaction** as the state change (or in the same handler when no UoW is needed).

```typescript
// SubmitForReviewUseCase
post.submitForReview();
await this.postRepository.update(postId, post);

const history = PostHistoryStatus.create({
  postId,
  changedById: currentUser.id,
  previousStatus,
  newStatus: PostStatus.PENDING_REVIEW,
});
await this.postHistoryStatusRepository.create(history);
```

## Clerk Identity Lifecycle

`User` rows are global (no campus). They link to `Guardian` and/or `Staff` profiles. The lifecycle of the Clerk identity tracks the entity's archival state:

| Action | Clerk effect | DB effect |
|--------|--------------|-----------|
| Create staff/guardian with user account | `provisionUser` | `User` + profile inserted |
| Archive guardian/staff | `lockIdentity` (best-effort) | `isArchived = true`, `User.isActive = false` |
| Restore guardian/staff | `unlockIdentity` (best-effort) | `isArchived = false`, `User.isActive = true` |
| Hard delete guardian/staff | `deleteIdentity` | `User` + profile rows removed |

The pattern is the [Saga](patterns/saga-pattern); see that doc for compensation rules.

## Migration Hygiene

When adding a new entity, choose the soft-delete style **at the schema level** — don't try to add `isArchived` later. Mass-migrating archived/deleted rows requires careful application code that may not be obvious.

```prisma
// Default for operational entities
isArchived Boolean @default(false) @map("is_archived")
@@index([isArchived])

// Default for content / engagement entities
isDeleted Boolean   @default(false) @map("is_deleted")
deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)
@@index([isDeleted])
```

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Using `isArchived` for `Post` | Hides the soft-delete timestamp; can't tell when a post was removed |
| Using `isDeleted` for `Student` | Restoring becomes ceremonial; lifecycle status (`DROPPED`/`ACTIVE`) is the real signal |
| Forgetting `softDelete` side effects (e.g. unpin a deleted post) | Pinned-but-deleted posts confuse the feed |
| Not filtering soft-deleted rows in default lists | Frontend gets phantom items |
| Cascade-deleting audit history | Audit becomes useless |
| Writing audit fields without an actor | Always plumb `currentUser.id` through the use case |

## Reference

| File | What |
|------|------|
| `src/domain/user-management/entities/student.entity.ts` | `archive()`/`restore()` flow |
| `src/domain/content-management/entities/post.entity.ts` | `softDelete()`/`restore()` with cascade unpin |
| `src/domain/content-management/entities/post-comment.entity.ts` | `isDeleted` + `deletedById` |
| `prisma/schema.prisma` | Both styles side by side |
| `src/application/user-management/use-cases/guardian/archive-guardian.use-case.ts` | Archive + Clerk lock |
| `src/application/user-management/use-cases/guardian/delete-guardian.use-case.ts` | Hard delete + Clerk delete |
| `src/application/content-management/use-cases/submit-for-review.use-case.ts` | History row pattern |
