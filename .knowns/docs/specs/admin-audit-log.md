---
title: Admin Audit Log
description: Cross-cutting audit log capturing administrative actions on student/guardian/staff/enrollment entities. Powers entity-history and actor-activity admin pages.
createdAt: '2026-05-18T21:08:44.409Z'
updatedAt: '2026-05-19T11:40:40.223Z'
tags:
  - spec
  - approved
---

## Overview

A cross-cutting audit log capturing administrative actions performed on student, guardian, staff, enrollment, and class entities. Powers two primary admin read surfaces:

1. **Entity history view** — "what happened to this student / guardian / staff?" — list audit events by `target_type` + `target_id`, newest first.
2. **Actor activity view** — "what has this staff member done?" — list audit events by `actor_id`, newest first.

The audit log is admin-only in v1, schema-ready for future guardian-visible expansion. All audit writes happen in the same DB transaction as the underlying mutation (strict atomicity).

## Locked Decisions

- **D1: Curated v1 scope.** Audit 19 specific action types covering enrollment lifecycle (5), profile edits (3), archive/restore (6), creation (3), and guardian-student linking (2). NOT "everything via interceptor". Action vocabulary is a hard-coded enum; new actions require code change. See **FR-1** for the full list. This matches the curated-action-list pattern used by GitHub, Stripe, Linear, and SIS systems like PowerSchool / Infinite Campus.

- **D2: Single unified `audit_event` table.** All action types share one schema with nullable `before_value` / `after_value` jsonb (for edit actions) and a `context` jsonb (for structural actions and snapshots). No table splits. One read path serves every UI; nullness is acceptable for action-shape variance.

- **D3: Snapshot + per-action template display rendering.** Audit row stores name snapshots in `context` (e.g. `actorName`, `targetName`, `fromClassName`, `toClassName`). Frontend renders display via per-action template keys: `audit.{ACTION_TYPE}.display`. Historical accuracy (snapshots are frozen at write time) + i18n-friendly (template static text is translatable) + survives hard delete of referenced entities.

- **D4: Sync write, same DB transaction, strict.** Audit row inserted in the same Prisma `$transaction` as the underlying action mutation. If audit insert fails, the action rolls back. Guarantees atomicity: every successful mutation has exactly one audit row, and every audit row reflects a successful mutation.

- **D5: Admin-only reads, schema-ready for guardian visibility.** v1 read endpoints require `audit.read` permission. Schema includes `visibility: 'ADMIN' | 'GUARDIAN_VISIBLE'` column defaulted to `'ADMIN'`. Switching individual action types to `'GUARDIAN_VISIBLE'` later requires only changing the per-action constant — no backfill.

- **D6: Indefinite retention, no partitioning in v1.** Keep all rows. Postgres handles ~10M rows on indexed reads without partitioning; at ~500 mutations/day, that's a ~50-year horizon. Add an ops alert when the table exceeds 5M rows or 5GB; revisit partitioning + cold-storage tiering then.

## Prerequisite (NOT a v1 spec deliverable — separate task)

- **Actor plumbing.** Every mutation use case constructor must take `currentUser: User` and thread it to mutations. The convention is documented in `@doc/architecture/audit-trail-soft-delete-patterns.md` but not yet applied to enrollment, student-profile-edit, guardian-edit, staff-edit, or archive use cases. **A separate task `actor-context-plumbing` must ship before this spec is implementable.**

## Requirements

### Functional Requirements

**FR-1: Action vocabulary — the 19 v1 actions.**

| Group | Action |
|---|---|
| Enrollment lifecycle | `ENROLL_STUDENT_TO_CLASS` |
| | `TRANSFER_STUDENT` |
| | `WITHDRAW_FROM_CLASS` |
| | `REGISTER_FOR_SCHOOL_YEAR` |
| | `WITHDRAW_FROM_SCHOOL_YEAR` |
| Profile edits | `EDIT_STUDENT_PROFILE` |
| | `EDIT_GUARDIAN_PROFILE` |
| | `EDIT_STAFF_PROFILE` |
| Archive / restore | `ARCHIVE_STUDENT` |
| | `RESTORE_STUDENT` |
| | `ARCHIVE_GUARDIAN` |
| | `RESTORE_GUARDIAN` |
| | `ARCHIVE_STAFF` |
| | `RESTORE_STAFF` |
| Creation | `CREATE_STUDENT` |
| | `CREATE_GUARDIAN` |
| | `CREATE_STAFF` |
| Guardian ↔ Student | `LINK_GUARDIAN_TO_STUDENT` |
| | `UNLINK_GUARDIAN_FROM_STUDENT` |

Encoded as a TypeScript string-union / enum and used as the type of the `action` column. Hard-coded — new actions require code change (deliberate; matches D1).

**FR-2: `audit_event` Prisma model.**

```prisma
model AuditEvent {
  id           String   @id @default(uuid()) @db.Uuid

  actorId      String   @map("actor_id") @db.Uuid
  targetType   String   @map("target_type")
  targetId     String   @map("target_id") @db.Uuid
  action       String

  beforeValue  Json?    @map("before_value")
  afterValue   Json?    @map("after_value")
  context      Json

  visibility   String   @default("ADMIN")
  campusId     String   @map("campus_id") @db.Uuid

  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([targetType, targetId, createdAt(sort: Desc)])
  @@index([actorId, createdAt(sort: Desc)])
  @@index([campusId, createdAt(sort: Desc)])
  @@map("audit_event")
}
```

No FK relations on `actorId` / `targetId` — they are bare UUIDs. Reason: audit rows must survive hard delete of the referenced entity (Scenario 4). Integrity is enforced at write time by the application layer, not at the DB level.

**FR-3: Write hook.** Every use case that performs one of the 19 actions in FR-1 MUST emit an `audit_event` row inside the same Prisma `$transaction` as the underlying mutation. Failure mode: audit insert failure rolls back the action (D4).

**FR-4: Context shape per action.** Each action type defines a structured `context` jsonb shape with name snapshots. Schemas live in supporting doc `@doc/references/audit-event-context-shapes` (created as part of implementation). Example for `TRANSFER_STUDENT`:

```json
{
  "actorName": "Alice Nguyen",
  "studentName": "Bob Tran",
  "fromClassId": "...",
  "fromClassName": "Sunflowers",
  "toClassId": "...",
  "toClassName": "Roses",
  "transferDate": "2026-05-18"
}
```

For `EDIT_*` actions, `context` carries only the actor/target snapshots; the field-level diff lives in `before_value` / `after_value` (only the changed fields, not the full entity).

**FR-5: Read endpoint — entity history.**
- `GET /audit/by-target?targetType=<type>&targetId=<uuid>&limit=<n>&offset=<n>`
- Auth: `Authorization: Bearer <jwt>` + `X-Campus-Id` + permission `audit.read`
- Returns: paginated audit events DESC by `createdAt`; system-enforced campus scope (NOT in `allowedFilterFields`)
- Response envelope: standard paginated response with `data: AuditEventResponse[]`

**FR-6: Read endpoint — actor activity.**
- `GET /audit/by-actor?actorId=<uuid>&limit=<n>&offset=<n>`
- Same auth contract as FR-5
- Returns: paginated audit events DESC by `createdAt`; system-enforced campus scope

**FR-7: Display-template registry.** Frontend has a single source-of-truth registry per action type, locale-resolvable:

- `audit.ENROLL_STUDENT_TO_CLASS.display` = `"Staff {{actorName}} enrolled Student {{studentName}} into Class {{className}}"`
- `audit.TRANSFER_STUDENT.display` = `"Staff {{actorName}} transferred Student {{studentName}} from {{fromClassName}} to {{toClassName}}"`
- ... one entry per action

### Non-Functional Requirements

- **NFR-1: Write latency.** Audit insert must not add more than ~10ms to a typical mutation (measured via Prisma query timing). Trivially met by a single indexed INSERT in the same transaction at kindergarten scale.
- **NFR-2: Read latency.** Entity-history and actor-activity reads must return in <100ms for the first page (50 rows) on tables up to 1M rows. Both indexes cover the access pattern.
- **NFR-3: Atomicity invariant.** Every successful mutation has exactly one `audit_event` row. Every `audit_event` row reflects a successful mutation. Enforced by D4 (same-transaction insert).
- **NFR-4: Historical truth.** Display strings reflect entity state at the time of the action, not current state. Enforced by D3 (snapshot in `context`).

## Acceptance Criteria

- [ ] AC-1: `AuditEvent` Prisma model exists per FR-2; migration applies cleanly on a fresh DB and on a DB with existing data.
- [ ] AC-2: All 19 action types are defined as a TypeScript string-union/enum and used at the application layer; an unknown `action` value is a TS compile error.
- [ ] AC-3: For each of the 19 actions, the corresponding use case emits an `audit_event` row inside the same `$transaction` as the mutation. Verified by use-case spec tests that mock the transaction and assert the recorder was called with the expected payload.
- [ ] AC-4: If the audit insert fails (forced via a thrown error in a mocked recorder), the mutation rolls back — no enrollment closed, no row created, no field updated. Verified by an integration test per action group.
- [ ] AC-5: `GET /audit/by-target` returns audit events for the named target, DESC by createdAt, paginated. Returns 200 with valid auth + permission; 401 without auth; 403 without `audit.read`; campus-scoped via `X-Campus-Id` (system-enforced, not user-controllable).
- [ ] AC-6: `GET /audit/by-actor` returns audit events by actor, DESC by createdAt, paginated. Same auth contract as AC-5.
- [ ] AC-7: Each action's `context` snapshot follows the documented shape from FR-4; verified via use-case spec tests asserting the recorder was called with the shape's required fields.
- [ ] AC-8: `visibility` column defaults to `'ADMIN'` for all v1 inserts. Switching one action's default to `'GUARDIAN_VISIBLE'` requires only a constant change in the action registry — no schema migration. Verified by a code-review checklist item.
- [ ] AC-9: `actorId` is NOT NULL at the DB level; INSERT with null `actorId` fails. Controller layer captures `currentUser.id` from the auth context and threads it through the use case. Verified by a controller unit test that asserts the use case receives the actor id.
- [ ] AC-10: Three indexes exist on `audit_event`: `(target_type, target_id, created_at DESC)`, `(actor_id, created_at DESC)`, `(campus_id, created_at DESC)`. Verified via `\d audit_event` on the dev DB after migration.
- [ ] AC-11: Display template registry exists in the FE i18n file with exactly one entry per action type; FE renders correctly for all 19 actions in unit tests (snapshot test against template output).
- [ ] AC-12: Audit rows survive hard delete of the referenced entity. Scenario 4 verified by an integration test.
- [ ] AC-13: Cross-campus reads return 404 / empty per Scenario 5; verified by an integration test.

## Scenarios

### Scenario 1: Happy path — TRANSFER captures both actor and target views
**Given** Staff Alice (`id=A`) and Student Bob (`id=B`) currently enrolled in Class C in Campus X
**When** Alice calls `POST /students/B/transfer` to move Bob to Class D (also in Campus X)
**Then** the transfer succeeds (source enrollment closes, target enrollment opens — both atomic with the audit write)
**And** one `audit_event` row exists with `action='TRANSFER_STUDENT'`, `actor_id=A`, `target_type='student'`, `target_id=B`, `context={actorName:'Alice', studentName:'Bob', fromClassName:'C', toClassName:'D', transferDate:'2026-05-18'}`, `campus_id=X`
**And** `GET /audit/by-target?targetType=student&targetId=B` returns that row on page 1
**And** `GET /audit/by-actor?actorId=A` returns that row on page 1

### Scenario 2: Atomicity — failed audit rolls back the mutation
**Given** the transfer would normally succeed
**When** the audit insert is forced to throw (e.g. recorder mocked to throw)
**Then** the transfer mutation rolls back: source enrollment has no `endDate`, no new target enrollment row exists
**And** the API returns 500
**And** no `audit_event` row exists for this attempt

### Scenario 3: Edit captures only the diff
**Given** Student Bob's `phoneNumber='555-1111'` and `fullName='Bob Tran'`
**When** Alice calls `PATCH /students/B` with `{ phoneNumber: '555-2222' }` (no name change)
**Then** an `audit_event` with `action='EDIT_STUDENT_PROFILE'`, `before_value={phoneNumber:'555-1111'}`, `after_value={phoneNumber:'555-2222'}` is written
**And** `fullName` does NOT appear in `before_value` or `after_value` (only changed fields are recorded)

### Scenario 4: Hard delete of target does not break the audit log
**Given** Bob has 10 audit events
**When** Bob is hard-deleted via `DangerStudentController.destroy`
**Then** the 10 audit rows remain (no FK cascade on `target_id`)
**And** `GET /audit/by-target?targetType=student&targetId=B` still returns the 10 rows
**And** the rendered display strings still contain "Bob" (snapshots from D3)

### Scenario 5: Cross-campus isolation
**Given** Alice belongs to Campus X
**When** Alice calls `GET /audit/by-target?targetType=student&targetId=Y` where Student Y belongs to Campus Z
**Then** the endpoint returns 404 (matches existing convention for cross-campus reads)
**And** no rows from Campus Z are returned even if filter parameters reference them

## Technical Notes

### Implementation seam — `AuditEventRecorder`

A single application-layer service exposes:
```ts
class AuditEventRecorder {
  async record(input: AuditEventInput, tx: Prisma.TransactionClient): Promise<void>
}
```

Use cases inject the recorder and call `recorder.record(..., tx)` **inside their existing `$transaction` blocks**. Centralizes audit-emission logic, keeps testability clean (mock the recorder), and ensures the same-transaction guarantee (D4).

### Why not a Prisma middleware

Tempting to auto-capture every Prisma mutation. Rejected because:
- Cannot construct semantic action names like `TRANSFER_STUDENT` from a pair of `enrollment.update` + `enrollment.create` calls
- Cannot resolve snapshots (D3) without domain context
- Couples audit emission to ORM-level events, not domain-level intentions
- Use-case-explicit emission is the clean way to map domain actions to audit events

### Snapshot resolution

Name snapshots in `context` are resolved at write time by reading the relevant entity inside the same transaction. Adds one extra `findUnique` per audit event (negligible at kindergarten scale, and the read is already inside the transaction so no extra round-trip cost).

### Pattern alignment

This spec aligns with the existing audit conventions in `@doc/architecture/audit-trail-soft-delete-patterns`:
- Required actor fields use `onDelete: Restrict` (here: bare UUID, application-enforced)
- Audit data is append-only (no UPDATE on `audit_event`)
- `createdAt` indexed, no `updatedAt`
- Same-transaction write pattern used by `PostHistoryStatus`

### Deferred to v2

- Cross-campus reads for super-admins
- Bulk export (CSV / JSON download)
- Time-range filter on reads (`?from=&to=`)
- Action-type filter on reads (`?actions=TRANSFER,WITHDRAW`)
- Guardian-visible reads (flip `visibility` defaults + add guardian-scoped endpoint)
- Cross-entity feed: `GET /audit/recent` for "today at campus X" admin view
- Auto-archival of rows older than 7 years (revisit when table exceeds 5M rows or 5GB)
- Audit for high-volume flows: attendance, post creation, login events
- Soft-delete / right-to-be-forgotten for audit rows (GDPR-like requests)

## Open Questions

- [ ] **Permission slug.** Is `audit.read` the right name, or should it match existing convention (e.g. `audit:read`, `AUDIT_READ`)? Resolved during implementation by inspecting the current permission registry.
- [ ] **Right-to-be-forgotten.** v1 says indefinite retention with no deletion. Confirm with ops / legal that audit rows never need deletion (e.g. when a staff member leaves and requests removal of their actions). If yes, v2 needs a redaction path that preserves the row shape but blanks the actor name.
- [ ] **Template registry location in FE.** Where in the frontend repo does the `audit.{ACTION}.display` registry live? Resolved by frontend team during implementation.
- [ ] **EDIT_*_PROFILE granularity.** A single `EDIT_STUDENT_PROFILE` row captures one update API call — even if the operator changed three fields at once, it's one audit row with a 3-field diff. Confirm this is the desired granularity vs one row per field changed. Recommendation: one row per API call (current FR-3) — cleaner timeline, atomicity matches the user's intent.
