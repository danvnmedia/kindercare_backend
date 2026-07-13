---
title: 'Audit Trail & Soft Delete Patterns'
description: Audit timestamps, audit user fields, isArchived vs isDeleted+deletedAt, history tables, and Clerk identity locking
createdAt: '2026-05-05T17:44:33.648Z'
updatedAt: '2026-07-11T16:28:12.219Z'
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

## Actor Plumbing for Admin Audit Log

The repository ships a single audit-log substrate for audited administrative mutations. Every mutation use case in the current 19-action audit vocabulary accepts `currentUser: User` as the last positional argument on `execute()`. The use case body may not consume it directly; transaction-bound audit recorder wiring reads `currentUser.id` and emits one `audit_event` row per audited action inside the same database transaction as the business mutation.

This actor-context plumbing was established so controllers pass the authenticated actor consistently before audit emission is wired into individual use cases.

**Pattern at the boundary:**

```typescript
// controller - extracts the actor and threads it
async create(
  @CampusContext() campusId: string,
  @Body() dto: CreateStudentRequest,
  @CurrentUser() currentUser: User,
) {
  return this.createStudentUseCase.execute({ ...dto, campusId }, currentUser);
}

// use case - accepts the actor for audit wiring
async execute(
  input: CreateStudentInput,
  currentUser: User,
): Promise<Student> {
  void currentUser; // retained until this mutation emits audit records
  // ... existing logic
}
```

**Why `@CurrentUser()` works:** the decorator returns `request.user`, populated lazily by `RequestContext.getUser()`. Every in-scope route is decorated with `@RequireCampusAccess()` (which triggers `CampusGuard.canActivate()` -> `requestContext.getUser()`), so by the time the param decorator fires, `request.user` already holds the full `User` domain entity. For controller methods without a downstream guard that triggers `RequestContext.getUser()`, call `this.requestContext.getUserOrFail()` directly.

**In-scope audited use cases:**

| Group | Use case | Action |
|---|---|---|
| Enrollment lifecycle | `enroll-student.use-case` | `ENROLL_STUDENT_TO_CLASS` |
| | `transfer-student.use-case` | `TRANSFER_STUDENT` |
| | `withdraw-student.use-case` | `WITHDRAW_FROM_CLASS` |
| | `register-for-school-year.use-case` | `REGISTER_FOR_SCHOOL_YEAR` |
| | `withdraw-from-school.use-case` | `WITHDRAW_FROM_SCHOOL_YEAR` |
| | `bulk-enroll-students.use-case` | per-row `ENROLL_STUDENT_TO_CLASS` |
| | `bulk-transfer-students.use-case` | per-row `TRANSFER_STUDENT` |
| Profile edits | `update-student.use-case` | `EDIT_STUDENT_PROFILE` |
| | `update-guardian.use-case` | `EDIT_GUARDIAN_PROFILE` |
| | `update-staff.use-case` | `EDIT_STAFF_PROFILE` |
| Archive / restore | `archive-student.use-case` | `ARCHIVE_STUDENT` |
| | `restore-student.use-case` | `RESTORE_STUDENT` |
| | `archive-guardian.use-case` | `ARCHIVE_GUARDIAN` |
| | `restore-guardian.use-case` | `RESTORE_GUARDIAN` |
| | `archive-staff.use-case` | `ARCHIVE_STAFF` |
| | `restore-staff.use-case` | `RESTORE_STAFF` |
| Creation | `create-student.use-case` | `CREATE_STUDENT` |
| | `create-guardian.use-case` | `CREATE_GUARDIAN` |
| | `create-staff.use-case` | `CREATE_STAFF` |
| Guardian / Student | `link-student-with-guardian.use-case` (student-keyed) | `LINK_GUARDIAN_TO_STUDENT` |
| | `link-student-to-guardian.use-case` (guardian-keyed) | `LINK_GUARDIAN_TO_STUDENT` |
| | `unlink-student-from-guardian.use-case` (both controllers) | `UNLINK_GUARDIAN_FROM_STUDENT` |

**Out of scope:** attendance, role/permission management, grade-level / school-year / class CRUD, and category reorder. Adding these areas requires expanding the audit action vocabulary and should be handled as separate scoped work.

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
| Using `isDeleted` for `Student` | Restoring becomes ceremonial; `isArchived` already toggles the recoverable lifecycle, and the derived `phase` view (`student_with_phase`) exposes `WAITING`/`ACTIVE`/`DEFERRED`/`GRADUATED`/`WITHDRAWN` without a stored status column |
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


## School-Year Enrollment Cancellation Audit

`cancel-school-year-enrollment.use-case` emits `CANCEL_SCHOOL_YEAR_ENROLLMENT` for the first successful cancellation only. The event is transaction-bound with the parent, affected children, historical finalization, and uncommitted Lifecycle reconciliation. Idempotent replay does not emit a duplicate event. The stable context keys are documented in @doc/references/audit-event-context-shapes.
