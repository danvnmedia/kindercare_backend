---
title: School Year Enrollment Model
description: Backend schema, domain, and HTTP additions that introduce a parent SchoolYearEnrollment record above the existing class-level Enrollment. Captures the student-school relationship for a given school year, owns grade level placement, and provides a clean anchor for derived student status. Builds on the class-enrollment period model.
createdAt: '2026-05-15T02:54:28.560Z'
updatedAt: '2026-05-15T11:39:16.672Z'
tags:
  - spec
  - approved
  - backend
  - class-management
  - enrollment
  - school-year
  - schema-change
---

## Overview

Today, enrollment is modeled at the class level only (`@doc/specs/class-enrollment-period-model`). A single `Enrollment` row represents a student's membership in one class. There is no record of "student is enrolled at the school for school year X in grade level Y" — that fact has to be reconstructed by joining enrollment rows.

This spec introduces a parent record, `SchoolYearEnrollment`, that owns the student↔(school year, grade level) relationship. Class enrollments become child rows under it. The parent captures the academic-year lifecycle (when the kid started at the school, when they left, why); child rows continue to capture class-level churn (transfers between classrooms, mid-year reshuffles).

This change unlocks: derived student status from enrollment state (eliminating drift between `Student.status` and reality), clean year-end promotion semantics (close parent, open next), and a single authoritative row for "is this kid our student right now?" queries.

Out of scope here but enabled by this work: year-end promotion endpoint, bulk-promote, end-of-school-year auto-close cron, and the parallel `student-status-simplification` spec.

## Locked Decisions

- **D1 — Explicit two-step registration.** A `SchoolYearEnrollment` row must be created via a dedicated endpoint (`POST /students/:studentId/school-year-enrollments`) before any class enrollment can be created for the same student in that school year. `EnrollStudentUseCase` rejects with `NO_SCHOOL_YEAR_ENROLLMENT` when no open parent exists for `(studentId, class.schoolYearId)`. No auto-create: registration is a deliberate act with paperwork, distinct from class placement.
- **D2 — Period-only lifecycle, mirroring `Enrollment`.** Parent row carries `enrollmentDate` + optional `exitDate` + optional `exitReason ∈ {WITHDRAWN, GRADUATED, COMPLETED}`. "Active" is defined by `exitDate IS NULL`. No separate `status` column. `TRANSFERRED` is intentionally absent from this enum — internal class transfers do not close the parent. The XOR invariant from the class-enrollment model applies: `exitDate` and `exitReason` must both be set or both be null.
- **D3 — Parent owns `gradeLevelId`; class enrollment validates a match.** Parent has `gradeLevelId` NOT NULL, fixed at create time. `EnrollStudentUseCase` (and bulk variants) rejects with `GRADE_LEVEL_MISMATCH` when `class.gradeLevelId !== parent.gradeLevelId`. Year-end promotion (v2) is the supported way to change a student's grade for a year. Captures the academic-year reality cleanly and matches how SIS systems model grade tracking.
- **D4 — Atomic cascade close on withdraw.** `WithdrawFromSchoolUseCase` closes the parent (`exitDate`, `exitReason=WITHDRAWN`) and any open child enrollment (`endDate=exitDate`, `exitReason=WITHDRAWN`) inside a single database transaction. Both succeed or both roll back. The caller never has to clean up child rows first. Mirrors the transactional pattern of `TransferStudentUseCase`.
- **D5 — Hard-fail backfill on grade-level conflicts.** Migration groups existing `enrollment` rows by `(studentId, class.schoolYearId)`. If any group contains rows spanning ≥ 2 grade levels, the migration aborts with a printed report of every conflicting `(studentId, schoolYearId)` pair. Sysadmin reconciles manually before re-running. No silent best-effort fixes. Same posture as D8 of `@doc/specs/class-enrollment-period-model`.
- **D6 — One open parent per `(student, schoolYear)`, DB-enforced.** Partial unique index `school_year_enrollment(student_id, school_year_id) WHERE exit_date IS NULL`. A student may simultaneously hold open parents in different school years (pre-registration over the summer transition is supported). Two open parents in the same school year are forbidden.
- **D7 — Promotion + bulk + cron deferred to v2.** v1 ships: register parent, withdraw parent (cascade), get history, plus the integration into existing class-enrollment use cases. Atomic `PromoteStudentUseCase`, bulk-promote, and the end-of-year auto-close cron are explicitly out of scope and tracked under a follow-up spec when operational pressure surfaces.

## Requirements

### Functional Requirements

- **FR-1 — Register endpoint.** `POST /students/:studentId/school-year-enrollments` accepts `{ schoolYearId, gradeLevelId, enrollmentDate, note? }` and creates a parent row. Rejects when an open parent already exists for that `(studentId, schoolYearId)` with `SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS`.
- **FR-2 — Withdraw endpoint (atomic cascade).** `POST /school-year-enrollments/:id/withdraw` accepts `{ exitDate?, reason: WITHDRAWN|GRADUATED|COMPLETED, note? }` and closes the parent + any open child enrollment in a single transaction. Same date applied to both rows. `exitDate` defaults to today.
- **FR-3 — History endpoint.** `GET /students/:studentId/school-year-enrollments` returns all parent rows for the student (active and closed) ordered by `enrollmentDate DESC`. Each row includes `schoolYear` (name, dates), `gradeLevel` (name), and the count of related child enrollments. Read-only.
- **FR-4 — Class-enrollment gate.** `EnrollStudentUseCase` validates that an open parent exists with `(studentId, schoolYearId = class.schoolYearId, gradeLevelId = class.gradeLevelId)` before creating any child enrollment. Rejects with `NO_SCHOOL_YEAR_ENROLLMENT` if no open parent matches `(student, schoolYear)`, and `GRADE_LEVEL_MISMATCH` if a parent exists but grade levels differ. Both bulk variants apply the same check per row.
- **FR-5 — Transfer-use-case continuity.** `TransferStudentUseCase` (and bulk) require the same parent gate. Since transfer always lands on a class with the same `schoolYearId` as the active enrollment (locked by D9 of the period spec — future endDate rejected), the existing parent is always present. Grade-level mismatch on the target class is rejected with `GRADE_LEVEL_MISMATCH`.
- **FR-6 — Child→parent FK.** Every `enrollment` row carries `school_year_enrollment_id` NOT NULL (after migration). The repository writes this on every new child row by resolving the matching open parent.
- **FR-7 — Schema migration with backfill.** Single Prisma migration adds the new table, the FK column on `enrollment`, backfills parent rows from existing enrollment data deterministically, sets the FK NOT NULL after backfill, and adds both the new partial unique index and any required supporting indexes.
- **FR-8 — Period invariants on parent.** Parent factory enforces: `gradeLevelId` non-null; `enrollmentDate` non-null; `exitDate >= enrollmentDate` AND `exitDate <= today`; XOR on `(exitDate, exitReason)`. `withdraw()` returns an immutable closed instance (mirrors `Enrollment.withdraw`).

### Non-Functional Requirements

- **NFR-1 — Active lookup is O(1) on indexed column.** `findOpenByStudentAndSchoolYear(studentId, schoolYearId)` resolves through the partial unique index and the supporting `(student_id, school_year_id)` index. No table scans.
- **NFR-2 — Backwards-compatible during deploy.** The migration is single-step but can be split (table + nullable FK → backfill → NOT NULL + partial unique index) if zero-downtime constraints surface during implementation. Default is single migration; document the split path as a known fallback.
- **NFR-3 — Atomic cascades hold under contention.** Withdraw and (future) promote operations rely on the database transaction; the repository must wrap both writes in a single `prisma.$transaction(...)` call. No two-phase commits; no application-level "best effort" rollbacks.
- **NFR-4 — Migration reversibility.** The migration ships a down step that drops the column, the table, and the indexes in the reverse order they were created. Rollback restores schema state without data loss in existing tables.

## Acceptance Criteria

### Domain entity

- [ ] **AC-1** `SchoolYearEnrollment` factory rejects creation when `gradeLevelId`, `studentId`, `campusId`, `schoolYearId`, or `enrollmentDate` is missing.
- [ ] **AC-2** Factory enforces XOR on `(exitDate, exitReason)`: both null OR both set; mixed rejected with explicit error.
- [ ] **AC-3** `withdraw(exitDate, reason)` returns a new immutable instance with `exitDate` and `exitReason` set, leaves the receiver untouched, and throws `SchoolYearEnrollmentAlreadyClosedException` if called on a closed row.
- [ ] **AC-4** `withdraw()` rejects `exitDate < enrollmentDate` and `exitDate > today` with `InvalidExitDateException`.
- [ ] **AC-5** `isActive()` returns `true` iff `exitDate === null`.

### Repository / persistence

- [ ] **AC-6** `SchoolYearEnrollmentRepository` exposes: `findById`, `findOpenByStudentAndSchoolYear`, `findAllByStudentId`, `save`, `update`, `withdrawWithChildren(parent, openChildEnrollment | null)`.
- [ ] **AC-7** `withdrawWithChildren` runs the parent UPDATE and the (optional) child UPDATE in a single Prisma transaction. Failure of either rolls back both, leaving `exit_date IS NULL` on both rows.
- [ ] **AC-8** DB partial unique index `(student_id, school_year_id) WHERE exit_date IS NULL` is created and enforced — second open INSERT for the same pair raises a unique-violation.
- [ ] **AC-9** Every `enrollment` row written after migration has `school_year_enrollment_id` NOT NULL. The migration sets the FK constraint, and `PrismaEnrollmentRepository.save` resolves it from the open parent.

### Application / use cases

- [ ] **AC-10** `RegisterForSchoolYearUseCase` rejects when a class with the resolved `(schoolYearId, gradeLevelId)` does not exist in the campus → `SCHOOL_YEAR_NOT_FOUND` or `GRADE_LEVEL_NOT_FOUND` as appropriate (404, cross-campus hidden as 404 per existing convention).
- [ ] **AC-11** `RegisterForSchoolYearUseCase` rejects with `SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS` (409) when an open parent already exists for `(studentId, schoolYearId)`.
- [ ] **AC-12** `RegisterForSchoolYearUseCase` rejects `enrollmentDate` outside `schoolYear.{startDate, endDate}` with `REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR` (400).
- [ ] **AC-13** `WithdrawFromSchoolUseCase` resolves the parent, optionally finds its single open child enrollment, and calls `withdrawWithChildren` atomically. Result returns both `closedParent` and `closedChild | null`.
- [ ] **AC-14** `WithdrawFromSchoolUseCase` rejects with `PARENT_ALREADY_CLOSED` (409) when called on a closed parent.
- [ ] **AC-15** `WithdrawFromSchoolUseCase` rejects `exitDate < parent.enrollmentDate` and `exitDate > today` (400, INVALID_EXIT_DATE).
- [ ] **AC-16** `EnrollStudentUseCase` rejects with `NO_SCHOOL_YEAR_ENROLLMENT` (409) when no open parent exists for `(studentId, class.schoolYearId)`.
- [ ] **AC-17** `EnrollStudentUseCase` rejects with `GRADE_LEVEL_MISMATCH` (409) when an open parent exists but `parent.gradeLevelId !== class.gradeLevelId`.
- [ ] **AC-18** `BulkEnrollStudentsUseCase` applies AC-16 / AC-17 per row, surfaced through the existing per-row failure log (no whole-call abort for these codes — they belong with the per-row tolerant pattern per `@doc/specs/bulk-enrollment`).
- [ ] **AC-19** `TransferStudentUseCase` and `BulkTransferStudentsUseCase` apply AC-17 against the target class.
- [ ] **AC-20** `GetStudentSchoolYearHistoryUseCase` returns rows ordered `enrollmentDate DESC`. Cross-campus students surface as 404 (per existing convention).

### HTTP layer

- [ ] **AC-21** `POST /students/:studentId/school-year-enrollments` returns `201` with the created row. Body shape matches `SchoolYearEnrollmentResponse` (id, studentId, schoolYearId, gradeLevelId, enrollmentDate, exitDate=null, exitReason=null, note, dates, optional schoolYear+gradeLevel relations).
- [ ] **AC-22** `POST /school-year-enrollments/:id/withdraw` returns `200` with `{ closedParent, closedChild | null }`. Validates `exitDate` (optional, ISO 8601 date), `reason` (required, enum), `note` (optional, ≤ 500 chars).
- [ ] **AC-23** `GET /students/:studentId/school-year-enrollments` returns a list of `SchoolYearEnrollmentSummaryResponse` rows (one per year), each with embedded `schoolYear` + `gradeLevel` + `childEnrollmentCount`.
- [ ] **AC-24** All three routes require `@RequireCampusAccess`. The campus header gates writes; missing/cross-campus surfaces consistent with existing student-enrollment endpoints (404 to hide existence).

### Migration

- [ ] **AC-25** Migration `add_school_year_enrollment` creates the table with all columns, indexes, and the partial unique index.
- [ ] **AC-26** Migration adds `enrollment.school_year_enrollment_id uuid` (initially nullable), backfills it from `class.schoolYearId` via the grouping rule, then alters it to NOT NULL with FK constraint.
- [ ] **AC-27** Backfill grouping: for each `(studentId, class.schoolYearId)`, insert one parent row with `enrollmentDate = MIN(child.enrollmentDate)`, `gradeLevelId = COALESCE(class.gradeLevelId for first chronological child)`. If `MAX(child.endDate) IS NOT NULL` AND no child is currently open in this group, the parent is closed with `exitDate = MAX(child.endDate)` and `exitReason = COMPLETED`. If any child is open (`endDate IS NULL`), parent stays open.
- [ ] **AC-28** Backfill aborts and prints a conflict report when any `(studentId, schoolYearId)` group spans multiple distinct `class.gradeLevelId` values. No silent fix-up. Migration exits non-zero.
- [ ] **AC-29** Migration is reversible — down step drops FK, column, indexes, and table in reverse order.

## Scenarios

### Scenario 1 — Register kid for the new school year (happy path)

**Given** an active student in campus A, with no existing parent rows for SY 2025-2026
**When** the user calls `POST /students/:id/school-year-enrollments { schoolYearId: "sy-2025-2026", gradeLevelId: "grade-mam", enrollmentDate: "2025-09-01" }`
**Then** a parent row is created with `exitDate=null`, `exitReason=null`, and the response returns 201 with the new row. A subsequent `POST /classes/:classId/enrollments` for a class in `(sy-2025-2026, grade-mam)` succeeds.

### Scenario 2 — Class enrollment rejected: no parent (gate)

**Given** the student has no open `SchoolYearEnrollment` for `class.schoolYearId`
**When** the user calls `POST /classes/:classId/enrollments`
**Then** the use case rejects with `409 NO_SCHOOL_YEAR_ENROLLMENT`. The class roster is unchanged.

### Scenario 3 — Class enrollment rejected: grade mismatch

**Given** the student has an open parent in SY 2025-2026 with `gradeLevelId=grade-mam`, and the user tries to enroll into a class in `(sy-2025-2026, grade-choi)`
**When** `POST /classes/:classId/enrollments` is called
**Then** the use case rejects with `409 GRADE_LEVEL_MISMATCH`. No child row is written.

### Scenario 4 — Atomic withdraw cascade (happy path)

**Given** the student has an open parent for SY 2024-2025 in `grade-mam` and an open child enrollment in class "Mầm A1"
**When** the user calls `POST /school-year-enrollments/:id/withdraw { exitDate: "2025-03-15", reason: "WITHDRAWN" }`
**Then** in one transaction, the parent and the child enrollment are both closed: `exitDate=2025-03-15`, `exitReason=WITHDRAWN` on the parent; `endDate=2025-03-15`, `exitReason=WITHDRAWN` on the child. Response includes both closed rows.

### Scenario 5 — Withdraw with no open child (parent-only)

**Given** the student has an open parent for SY 2025-2026 but has not yet been placed into a class (registration done, class enrollment pending)
**When** `POST /school-year-enrollments/:id/withdraw { reason: "WITHDRAWN" }`
**Then** only the parent is closed; the response returns `{ closedParent, closedChild: null }`. Transaction wraps a single write.

### Scenario 6 — Pre-register for next school year (edge case)

**Given** the student has an open parent for the current school year SY 2024-2025 and the school is taking early registration for SY 2025-2026
**When** the user calls `POST /students/:id/school-year-enrollments { schoolYearId: "sy-2025-2026", gradeLevelId: "grade-choi", enrollmentDate: "2025-06-01" }`
**Then** the parent is created successfully. The student now has two open parents (one per school year). Class enrollment for SY 2025-2026 is gated on the grade-choi parent existing — independent of the still-open SY 2024-2025 parent.

### Scenario 7 — Second registration in same school year rejected

**Given** the student already has an open parent for SY 2025-2026
**When** the user calls `POST /students/:id/school-year-enrollments` for the same `schoolYearId`
**Then** the use case rejects with `409 SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS`. The partial unique index would also enforce this at DB level; the use-case check returns the typed error before reaching the DB.

### Scenario 8 — Transfer between classes (parent unchanged)

**Given** the student has an open parent for SY 2024-2025 in `grade-mam` and an active enrollment in class "Mầm A1"
**When** the user calls `POST /students/:id/transfer { toClassId: "mam-b2", transferDate: "2024-11-10" }` where `mam-b2.gradeLevelId === grade-mam`
**Then** the active enrollment is closed with `exitReason=TRANSFERRED` and a new enrollment opens in "Mầm B2" — both atomic. The parent is **unchanged**: still open, same `gradeLevelId`, same `enrollmentDate`.

### Scenario 9 — Transfer to wrong grade level rejected

**Given** the same setup, target class is in `grade-choi`
**When** `POST /students/:id/transfer { toClassId: "choi-a1" }`
**Then** the use case rejects with `409 GRADE_LEVEL_MISMATCH`. No child rows are written or closed.

### Scenario 10 — Withdraw twice (edge case)

**Given** an already-closed parent
**When** the user calls `POST /school-year-enrollments/:id/withdraw` again
**Then** rejected with `409 PARENT_ALREADY_CLOSED`. Idempotency is not assumed at this endpoint; the closed row reflects the first withdrawal's exit date and reason.

### Scenario 11 — Invalid exitDate rejected

**Given** an open parent with `enrollmentDate=2025-09-01`
**When** the user calls withdraw with `exitDate=2025-08-30` (before enrollment) or `exitDate=2099-01-01` (future)
**Then** rejected with `400 INVALID_EXIT_DATE` and a message indicating which bound was violated.

### Scenario 12 — Backfill happy path

**Given** existing `enrollment` rows where every `(studentId, schoolYearId)` group's child classes share a single `gradeLevelId`
**When** the migration runs
**Then** one parent row is created per group with `enrollmentDate=MIN(child.enrollmentDate)`, `gradeLevelId` inherited from the children, `exitDate=null` if any child is open, else `exitDate=MAX(child.endDate)` and `exitReason=COMPLETED`. Every child row gets its `school_year_enrollment_id` populated.

### Scenario 13 — Backfill conflict aborts migration

**Given** at least one student has child enrollments spanning two grade levels in the same school year (data anomaly)
**When** the migration runs
**Then** the migration prints all conflicting `(studentId, schoolYearId, [gradeLevels])` tuples, **does not insert any parent rows**, and exits non-zero. Manual reconciliation by sysadmin is required before re-running.

### Scenario 14 — Pre-existing one-active-enrollment invariant preserved

**Given** existing partial unique index `enrollment(student_id) WHERE end_date IS NULL` from the period spec
**When** this spec ships
**Then** the index is unchanged. A student still has at most one open class enrollment overall. Pre-registration (Scenario 6) means an open parent for next year exists, but no open child class enrollment exists in next year until SY starts.

## Technical Notes

### Migration shape

```
20260514_add_school_year_enrollment

-- Step 1: Create parent table
CREATE TABLE school_year_enrollment (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid NOT NULL REFERENCES student(id) ON DELETE CASCADE,
  campus_id       uuid NOT NULL REFERENCES campus(id) ON DELETE RESTRICT,
  school_year_id  uuid NOT NULL REFERENCES school_year(id) ON DELETE RESTRICT,
  grade_level_id  uuid NOT NULL REFERENCES grade_level(id) ON DELETE RESTRICT,
  enrollment_date date NOT NULL,
  exit_date       date,
  exit_reason     text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sye_student          ON school_year_enrollment (student_id);
CREATE INDEX idx_sye_school_year      ON school_year_enrollment (school_year_id);
CREATE INDEX idx_sye_grade_level      ON school_year_enrollment (grade_level_id);
CREATE INDEX idx_sye_campus           ON school_year_enrollment (campus_id);
CREATE UNIQUE INDEX idx_sye_one_open_per_year
  ON school_year_enrollment (student_id, school_year_id) WHERE exit_date IS NULL;

-- Step 2: Add nullable FK to existing enrollment table
ALTER TABLE enrollment
  ADD COLUMN school_year_enrollment_id uuid REFERENCES school_year_enrollment(id) ON DELETE RESTRICT;

-- Step 3: Backfill parent rows + child FK (deterministic, hard-fail on conflict)
--   See AC-27 / AC-28. Runs in plpgsql with conflict detection upfront.

-- Step 4: Make FK NOT NULL
ALTER TABLE enrollment ALTER COLUMN school_year_enrollment_id SET NOT NULL;
CREATE INDEX idx_enrollment_parent ON enrollment (school_year_enrollment_id);
```

### Repository changes

**New port** `src/application/class-management/ports/school-year-enrollment.repository.ts`:

- `findById(id): Promise<SchoolYearEnrollment | null>`
- `findOpenByStudentAndSchoolYear(studentId, schoolYearId): Promise<SchoolYearEnrollment | null>`
- `findAllByStudentId(studentId): Promise<SchoolYearEnrollment[]>` (ordered `enrollmentDate DESC`)
- `save(entity): Promise<SchoolYearEnrollment>`
- `update(entity): Promise<SchoolYearEnrollment>`
- `withdrawWithChildren(parent, openChild | null): Promise<{ closedParent, closedChild | null }>` — single Prisma transaction

**Existing `EnrollmentRepository` adjustments:** add `school_year_enrollment_id` to mapper and `save` paths. The repo's `save` accepts the parent FK as part of the entity (resolved at use-case layer, not in the repo).

### Use-case ownership

- New: `RegisterForSchoolYearUseCase`, `WithdrawFromSchoolUseCase`, `GetStudentSchoolYearHistoryUseCase`.
- Modified: `EnrollStudentUseCase`, `BulkEnrollStudentsUseCase`, `TransferStudentUseCase`, `BulkTransferStudentsUseCase` — all add the parent-existence + grade-match check before any child write.

### HTTP wiring

New routes (all under `@RequireCampusAccess`):

- `POST   /students/:studentId/school-year-enrollments` → `RegisterForSchoolYearUseCase`
- `POST   /school-year-enrollments/:id/withdraw`       → `WithdrawFromSchoolUseCase`
- `GET    /students/:studentId/school-year-enrollments` → `GetStudentSchoolYearHistoryUseCase`

Lives in a new controller `school-year-enrollment.controller.ts` under `src/infra/http/controllers/class-management/`, cohabiting with the other enrollment controllers.

### Error codes (additions)

New top-level codes in `enrollment-error-codes.ts` (or a new `school-year-enrollment-error-codes.ts` if scope warrants):

- `NO_SCHOOL_YEAR_ENROLLMENT` (409) — class enrollment attempted without open parent
- `GRADE_LEVEL_MISMATCH` (409) — class.gradeLevelId ≠ parent.gradeLevelId
- `SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS` (409) — second open parent in same (student, schoolYear)
- `PARENT_ALREADY_CLOSED` (409) — withdraw on closed parent
- `REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR` (400) — enrollmentDate outside SY range
- `INVALID_EXIT_DATE` (400) — exitDate < enrollmentDate or > today

### Prisma schema diff (illustrative)

```prisma
model SchoolYearEnrollment {
  id              String   @id @default(uuid()) @db.Uuid
  studentId       String   @map("student_id") @db.Uuid
  campusId        String   @map("campus_id") @db.Uuid
  schoolYearId    String   @map("school_year_id") @db.Uuid
  gradeLevelId    String   @map("grade_level_id") @db.Uuid
  enrollmentDate  DateTime @map("enrollment_date") @db.Date
  exitDate        DateTime? @map("exit_date") @db.Date
  exitReason      String?  @map("exit_reason")
  note            String?

  student      Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)
  campus       Campus      @relation(fields: [campusId], references: [id], onDelete: Restrict)
  schoolYear   SchoolYear  @relation(fields: [schoolYearId], references: [id], onDelete: Restrict)
  gradeLevel   GradeLevel  @relation(fields: [gradeLevelId], references: [id], onDelete: Restrict)
  enrollments  Enrollment[]

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([studentId])
  @@index([schoolYearId])
  @@index([gradeLevelId])
  @@index([campusId])
  // Partial unique applied via raw SQL in the migration:
  //   CREATE UNIQUE INDEX idx_sye_one_open_per_year
  //     ON school_year_enrollment (student_id, school_year_id) WHERE exit_date IS NULL;
  @@map("school_year_enrollment")
}

model Enrollment {
  // ... existing fields ...
  schoolYearEnrollmentId String @map("school_year_enrollment_id") @db.Uuid
  schoolYearEnrollment   SchoolYearEnrollment @relation(fields: [schoolYearEnrollmentId], references: [id], onDelete: Restrict)

  @@index([schoolYearEnrollmentId])
  // ... existing indexes ...
}
```

### Domain immutability

Per the four-layer immutability pattern (`@doc/guides/code-generation-pattern#immutability`): `studentId`, `campusId`, `schoolYearId`, `gradeLevelId` are immutable after creation. Enforced at entity (no setter, no path through `update()`), factory (required on create), mapper `toPrismaUpdate` (omitted), and repository port (no rename method).

### Out of scope (explicit)

- `PromoteStudentUseCase` + endpoint (atomic close current parent + open next year's). v2.
- `BulkPromoteStudentsUseCase`. v2.
- End-of-school-year auto-close cron. v2.
- `StudentStatus` enum reduction — covered by the parallel `student-status-simplification` spec, which depends on this one shipping first.
- Frontend changes (hooks, services, UI). Stalls until this spec ships, but those changes belong to the consuming frontend spec.
- Soft-delete on `school_year_enrollment`. Closed rows live forever by design (mirrors class enrollment).
- Read endpoints filtered by status (e.g. "all currently active students"). Surface arrives naturally with the simplification spec.
- Re-opening a closed parent. No use case for it; would require a separate verb if a real need surfaces.

## Open Questions

- [ ] Should `RegisterForSchoolYearUseCase` accept an optional `note` field at create time, separate from withdraw `note`? Default proposal: yes, single optional field; both flows write to the same column.
- [ ] When a school year is archived, can an open parent for that school year still be withdrawn? Default proposal: yes (archived ≠ closed; withdraw is always allowed on open parents).
- [ ] Does the history endpoint (`GET /students/:studentId/school-year-enrollments`) need pagination? Initial volume: ≤ 6 rows per student over a kindergarten career. Default proposal: no pagination in v1.
- [ ] Should the cascade-close on withdraw also notify the attendance system to stop expecting check-ins for the closed period? Default proposal: out of scope — attendance reads enrollment state directly.

## Resolved

(None yet — to be moved here from Open Questions as decisions land.)
