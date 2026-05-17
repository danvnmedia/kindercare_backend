---
title: Student Status Simplification
description: Backend refactor that removes Student.status, derives lifecycle phase from Enrollment + SchoolYearEnrollment + isArchived, exposes phase via a Postgres view, and eliminates the archive()/restore() double-writes.
createdAt: '2026-05-16T00:46:13.770Z'
updatedAt: '2026-05-16T01:20:02.234Z'
tags:
  - spec
  - approved
  - backend
  - user-management
  - schema-change
  - simplification
---

## Overview

Removes the `Student.status` column and its 6-value `StudentStatus` enum (`DROPPED`, `ACTIVE`, `GRADUATED`, `TRIAL`, `WAITING`, `DEFERRED`) in favor of a derived `phase` field computed from existing relations:

- `Enrollment` — class-level enrollment state (`ACTIVE`)
- `SchoolYearEnrollment` — yearly parent with `exitReason` (`GRADUATED`, `WITHDRAWN`, `DEFERRED`)
- `Student.isArchived` — admin archive overlay (`ARCHIVED`)

Why now: the @doc/specs/school-year-enrollment-model substrate shipped with a parent `SchoolYearEnrollment` carrying `exitReason ∈ {WITHDRAWN, GRADUATED, COMPLETED, TRANSFERRED}`. That parent is now the canonical lifecycle source. Continuing to store a status column on `Student` duplicates that signal and has caused three concrete bugs:

1. Three default-source-of-truth values across DB / use case / entity (Prisma=`WAITING`, use case=`WAITING`, entity factory=`ACTIVE`).
2. `archive()` double-writes (`isArchived=true` AND `status=DROPPED`); `restore()` symmetrically double-writes (`isArchived=false` AND `status=ACTIVE`).
3. The enum mixes lifecycle states (`DROPPED`, `GRADUATED`) with prospect funnel states (`TRIAL`, `WAITING`, `DEFERRED`) — the lifecycle half is already captured by `ExitReason` on the parent.

Outcome: zero status drift possible, single source of truth for each axis (enrollment / SY parent / isArchived), and a clean derived `phase` taxonomy exposed via a Postgres view.

## Locked Decisions

- **D1** — Drop `Student.status` column entirely. No replacement enum on `Student`.
- **D2** — Phase is a computed/derived field, not a stored column. Storage stays in `Enrollment`, `SchoolYearEnrollment`, and `Student.isArchived`.
- **D3** — `archive()` writes only `isArchived=true`. `restore()` writes only `isArchived=false`. No status side-write on either.
- **D4** — Pause/leave-of-absence is unmodeled. A paused student keeps an open `Enrollment` and shows phase `ACTIVE`; the pause shows up as sustained absence in the attendance log only.
- **D5** — `TRIAL` is removed as a distinct concept. No `Enrollment.isTrial` flag, no separate prospect table. Operationally not used.
- **D6** — Phase taxonomy:
  - `ACTIVE` — open `Enrollment` exists
  - `WAITING` — registered, no open `Enrollment`, no open `SchoolYearEnrollment`
  - `DEFERRED` — open `SchoolYearEnrollment` whose `schoolYear.startDate > today`, no open `Enrollment`
  - `GRADUATED` — latest closed `SchoolYearEnrollment.exitReason = GRADUATED`, no current open enrollment
  - `WITHDRAWN` — latest closed `SchoolYearEnrollment.exitReason = WITHDRAWN`, no current open enrollment
  - `ARCHIVED` — `isArchived=true` (orthogonal overlay; returned alongside the underlying phase, not as a replacement)
- **D7** — Phase derived via a Postgres view `student_with_phase`. Repositories read from the view for list/find queries to project `phase` into the entity; writes still target the underlying `student` table.
- **D8** — Hard cutover migration. Single migration drops the column. No reconciliation pass (any `GRADUATED`/`DROPPED`/`TRIAL` signal that isn't already derivable from `Enrollment` / `SchoolYearEnrollment` / `isArchived` is permanently lost).
- **D9** — `GET /classes/:classId/eligible-students` drops the `includeStatuses` query parameter entirely. Eligibility predicate becomes `isArchived=false AND scope.campusId AND NOT EXISTS open Enrollment`. Phase narrowing is a client-side concern.

## Requirements

### Functional Requirements

- **FR-1** — `StudentStatus` enum is removed from the domain layer (`src/domain/user-management/enums/student-status.enum.ts` deleted).
- **FR-2** — `status` column is removed from the `student` table (Prisma schema + DB migration).
- **FR-3** — A Postgres view `student_with_phase` is created exposing all `student` columns plus a computed `phase: string` per the D6 taxonomy.
- **FR-4** — Every `Student` API response includes `phase` (read from the view) and `isArchived` (read from the table); the two are orthogonal.
- **FR-5** — `Student.archive()` mutates only `isArchived`. `Student.restore()` mutates only `isArchived`. Neither method touches phase / status / anything else.
- **FR-6** — `Student.create()` factory no longer has a `status` prop. Phase is not initialized; it derives at read time.
- **FR-7** — `POST /students` accepts no `status` field in the request body.
- **FR-8** — `PATCH /students/:id` accepts no `status` field in the request body.
- **FR-9** — `GET /classes/:classId/eligible-students` rejects the `includeStatuses` query parameter (returns 400 if supplied, to fail loudly during transition) or silently ignores it. Choose loudly per D9 phrasing.
- **FR-10** — `PrismaStudentRepository` reads from `student_with_phase` for `findById`, `findByEmail*`, `findByPhone*`, `findByStudentCode*`, `findByCampusId`, `findByIds`, `findAll`, `findEligibleForClass`. Writes (`save`, `update`, `delete`) target the underlying `student` table.
- **FR-11** — Eligibility predicate in `PrismaStudentRepository.findEligibleForClass` is `isArchived=false AND scope.campusId AND NOT EXISTS open Enrollment` — the existing status filter contribution is removed.
- **FR-12** — All tests that reference `StudentStatus` are updated; entity, mapper, use case, repo, DTO specs all compile after the change.

### Non-Functional Requirements

- **NFR-1** — Migration runs in a single transaction: create view, drop column. No phased rollout.
- **NFR-2** — View query performance is acceptable for student list pagination at expected scale (low thousands of students per campus). Indexes on `enrollment(student_id, end_date)` and `school_year_enrollment(student_id, exit_date)` validated as present.
- **NFR-3** — No backward compatibility. The API surface change is breaking and ships in lockstep with frontend consumers.
- **NFR-4** — Documentation in @doc/architecture/audit-trail-soft-delete-patterns and @doc/references/bulk-enrollment-backend-handoff is updated to reflect the new shape.

## Acceptance Criteria

- [ ] **AC-1** — `src/domain/user-management/enums/student-status.enum.ts` no longer exists.
- [ ] **AC-2** — `prisma/schema.prisma` model `Student` has no `status` field.
- [ ] **AC-3** — `prisma/schema.prisma` declares a `student_with_phase` view (or equivalent unmanaged model) with all student fields plus `phase: String`.
- [ ] **AC-4** — Migration file creates the view, drops the `status` column, and runs in a single transaction.
- [ ] **AC-5** — `Student` entity has no `status` getter, no `status` prop, no `StudentStatus` import.
- [ ] **AC-6** — `Student.archive()` mutates only `props.isArchived` and `props.updatedAt` (verified via spec).
- [ ] **AC-7** — `Student.restore()` mutates only `props.isArchived` and `props.updatedAt` (verified via spec).
- [ ] **AC-8** — `Student.create()` factory has no `status` parameter.
- [ ] **AC-9** — `CreateStudentRequest` DTO has no `status` field. `IsEnum(StudentStatus)` decorator removed.
- [ ] **AC-10** — `UpdateStudentRequest` DTO has no `status` field. `IsEnum(StudentStatus)` decorator removed.
- [ ] **AC-11** — `EligibleStudentsQuery` DTO has no `includeStatuses` field; `ELIGIBLE_STATUS_ALLOW_LIST` removed.
- [ ] **AC-12** — `GetEligibleStudentsForClassUseCase` does not reference `StudentStatus` or set a status filter.
- [ ] **AC-13** — `PrismaStudentRepository.findEligibleForClass` predicate is `isArchived=false AND campusId match AND NOT EXISTS open Enrollment`. No status filter contribution.
- [ ] **AC-14** — `PrismaStudentMapper.toDomain` and `toDomainSimple` read `phase` from the view-typed input (where applicable) and project it onto the domain entity.
- [ ] **AC-15** — `Student` domain entity exposes `phase` as a read-only getter, populated from the view at mapping time. Null/undefined `phase` from a non-view source is allowed (mapper returns undefined when reading from raw `student` table writes).
- [ ] **AC-16** — `StudentResponse` DTO exposes both `phase` and `isArchived`.
- [ ] **AC-17** — `GET /students` and `GET /students/:id` return `phase` populated correctly per the D6 taxonomy.
- [ ] **AC-18** — A newly-registered student (no enrollment, no SY parent, isArchived=false) returns `phase=WAITING`.
- [ ] **AC-19** — A student with one open Enrollment returns `phase=ACTIVE`.
- [ ] **AC-20** — A student whose latest SY parent is closed with `exitReason=GRADUATED` and has no current open Enrollment returns `phase=GRADUATED`.
- [ ] **AC-21** — A student whose latest SY parent is closed with `exitReason=WITHDRAWN` and has no current open Enrollment returns `phase=WITHDRAWN`.
- [ ] **AC-22** — A student with an open SY parent whose `schoolYear.startDate > today` and no open Enrollment returns `phase=DEFERRED`.
- [ ] **AC-23** — Archive overlay: a student with `isArchived=true` returns `isArchived: true` AND the correct underlying derived phase (the overlay does not replace phase).
- [ ] **AC-24** — All test files referencing `StudentStatus` are updated; `npm test` passes.
- [ ] **AC-25** — @doc/architecture/audit-trail-soft-delete-patterns "Status reset" table row is removed.
- [ ] **AC-26** — @doc/references/bulk-enrollment-backend-handoff reflects the new eligible-students shape.
## Scenarios

### Scenario 1 — Newly registered student (happy path, WAITING)

**Given** a freshly-created student in campus `c1`, with no `Enrollment` row, no `SchoolYearEnrollment` row, `isArchived=false`
**When** `GET /students/:id` is called
**Then** the response includes `phase: "WAITING"` and `isArchived: false`

### Scenario 2 — Currently enrolled (ACTIVE)

**Given** a student with exactly one `Enrollment` row where `endDate IS NULL`
**When** `GET /students/:id` is called
**Then** the response includes `phase: "ACTIVE"`

### Scenario 3 — Pre-registered for next school year (DEFERRED)

**Given** a student with one open `SchoolYearEnrollment` for a school year starting on `2026-09-01` (future relative to today `2026-05-15`) and no open `Enrollment`
**When** `GET /students/:id` is called
**Then** the response includes `phase: "DEFERRED"`

### Scenario 4 — Graduated (GRADUATED)

**Given** a student whose most recent `SchoolYearEnrollment` is closed with `exitDate=2026-06-30` and `exitReason=GRADUATED`, and who has no current open `Enrollment`
**When** `GET /students/:id` is called
**Then** the response includes `phase: "GRADUATED"`

### Scenario 5 — Withdrawn mid-year (WITHDRAWN)

**Given** a student whose most recent `SchoolYearEnrollment` is closed with `exitReason=WITHDRAWN`, and who has no current open `Enrollment`
**When** `GET /students/:id` is called
**Then** the response includes `phase: "WITHDRAWN"`

### Scenario 6 — Archived overlay (ARCHIVED + underlying phase)

**Given** a student with one open `Enrollment` AND `isArchived=true` (admin archived a row that still has an open enrollment somehow — possible if archive was called before withdraw)
**When** `GET /students/:id` is called
**Then** the response includes `isArchived: true` AND `phase: "ACTIVE"` (the underlying enrollment state; archive is orthogonal)

### Scenario 7 — Eligibility query excludes ACTIVE students naturally

**Given** class `c1` in campus `cmp1`, student `s1` with no open Enrollment in `cmp1`, student `s2` with an open `Enrollment` in some other class `c2` in `cmp1`
**When** `GET /classes/c1/eligible-students` is called
**Then** `s1` is returned, `s2` is excluded by the `NOT EXISTS open Enrollment` predicate, and no `includeStatuses` query param is accepted

### Scenario 8 — Pause = sustained absence (no schema effect)

**Given** a student with an open `Enrollment` who has not attended class for 6 months
**When** `GET /students/:id` is called
**Then** the response includes `phase: "ACTIVE"` — pause is invisible at the phase layer; absence shows in attendance logs only

### Scenario 9 — Archive then restore (no status side-effect)

**Given** a student with `phase=ACTIVE` (open Enrollment) and `isArchived=false`
**When** admin calls `DELETE /students/:id` (which maps to `archive()`)
**Then** the row has `isArchived=true`, the open `Enrollment` row is unaffected, and `phase` still derives to `ACTIVE`
**When** admin then calls `PATCH /students/:id/restore`
**Then** `isArchived=false`, no other state changes; `phase` still `ACTIVE`

### Scenario 10 — Create student rejects status (FR-7)

**Given** a `POST /students` request body that includes a `status` field
**When** the request is validated
**Then** the request is rejected with `400` and a clear validation error (no whitelist on `status` since the field is unknown)

### Scenario 11 — Eligibility request rejects includeStatuses (FR-9)

**Given** a `GET /classes/:id/eligible-students?includeStatuses=WAITING` request
**When** the controller validates the query
**Then** the request is rejected with `400` (whitelist validation on unknown query keys is enabled) OR the parameter is silently ignored — implementation chooses one and tests assert the chosen behavior

## Technical Notes

### View definition (sketch)

```sql
CREATE VIEW student_with_phase AS
SELECT
  s.*,
  CASE
    WHEN s.is_archived = true AND EXISTS (
      SELECT 1 FROM enrollment e
      WHERE e.student_id = s.id AND e.end_date IS NULL
    )
      THEN 'ACTIVE'
    WHEN EXISTS (
      SELECT 1 FROM enrollment e
      WHERE e.student_id = s.id AND e.end_date IS NULL
    )
      THEN 'ACTIVE'
    WHEN EXISTS (
      SELECT 1 FROM school_year_enrollment sye
      JOIN school_year sy ON sy.id = sye.school_year_id
      WHERE sye.student_id = s.id
        AND sye.exit_date IS NULL
        AND sy.start_date > NOW()
    )
      THEN 'DEFERRED'
    WHEN (
      SELECT sye.exit_reason
      FROM school_year_enrollment sye
      WHERE sye.student_id = s.id AND sye.exit_date IS NOT NULL
      ORDER BY sye.exit_date DESC
      LIMIT 1
    ) = 'GRADUATED'
      THEN 'GRADUATED'
    WHEN (
      SELECT sye.exit_reason
      FROM school_year_enrollment sye
      WHERE sye.student_id = s.id AND sye.exit_date IS NOT NULL
      ORDER BY sye.exit_date DESC
      LIMIT 1
    ) = 'WITHDRAWN'
      THEN 'WITHDRAWN'
    ELSE 'WAITING'
  END AS phase
FROM student s;
```

Priority order (top-to-bottom): ACTIVE > DEFERRED > GRADUATED > WITHDRAWN > WAITING. A graduated student who re-enrolls becomes ACTIVE again — the open `Enrollment` short-circuits the GRADUATED branch.

`ARCHIVED` is **not** a phase value in the view — it's an orthogonal `isArchived: boolean` returned alongside `phase`. This mirrors how `audit-trail-soft-delete-patterns` treats `isArchived` everywhere else.

### Prisma view binding

Enable `previewFeatures = ["views"]` in `generator client` if not already enabled. Declare a Prisma `view` block (or an unmanaged model with the same fields plus `phase`) so the Prisma client can query the view as `prisma.studentWithPhase`.

The Prisma `view` feature is in preview at the cutoff; if instability surfaces, fall back to:
- model `Student` reads from the view's underlying table for writes
- a separate raw query helper (`$queryRawTyped`) for view reads

### Repository mapping

`PrismaStudentRepository.findById` (and siblings) read from `student_with_phase`; the mapper accepts a union type `(PrismaStudent | PrismaStudentWithPhase) & relations` and projects `phase` (optional/nullable when reading from raw table writes immediately post-save).

Writes (`save`, `update`) target the underlying `student` table. The view is read-only.

### Migration order (single transaction)

```sql
BEGIN;
  CREATE VIEW student_with_phase AS SELECT ...;
  ALTER TABLE student DROP COLUMN status;
COMMIT;
```

Prisma migration file does both in one `migration.sql`. Application code change ships in the same PR.

### Code-change checklist

Files to delete:
- `src/domain/user-management/enums/student-status.enum.ts`

Files to modify (per Grep coverage during research):
- `prisma/schema.prisma` — drop `status` field on `Student`, add view declaration
- `src/domain/user-management/entities/student.entity.ts` — remove `status` prop/getter/factory param; simplify `archive()` and `restore()`; add optional `phase` projection
- `src/domain/user-management/entities/student.entity.spec.ts` — remove status assertions; add phase assertions for read paths
- `src/application/user-management/use-cases/student/create-student.use-case.ts` — remove `status` from input + entity create call
- `src/application/user-management/use-cases/student/update-student.use-case.ts` — remove `status` from input + update profile
- `src/application/user-management/use-cases/student/archive-student.use-case.spec.ts` — drop status assertions
- `src/application/user-management/use-cases/student/restore-student.use-case.spec.ts` — drop status assertions
- `src/application/user-management/use-cases/student/get-eligible-students-for-class.use-case.ts` — drop `includeStatuses` handling, no status filter
- `src/application/user-management/use-cases/student/get-eligible-students-for-class.use-case.spec.ts` — drop status-related test cases
- `src/application/user-management/ports/student.repository.ts` — update `findEligibleForClass` doc comment
- `src/infra/persistence/prisma/repositories/prisma-student.repository.ts` — wire reads to view, drop status filter contribution
- `src/infra/persistence/prisma/repositories/prisma-student.repository.spec.ts` — update tests
- `src/infra/persistence/prisma/mapper/prisma-student.mapper.ts` — drop status mapping, add phase projection
- `src/infra/http/dtos/user-management/student/create-student.request.ts` — drop status field
- `src/infra/http/dtos/user-management/student/update-student.request.ts` — drop status field
- `src/infra/http/dtos/user-management/student/student.response.ts` — drop status, add phase
- `src/infra/http/dtos/class-management/eligible-students.query.ts` — drop `includeStatuses` and allow-list
- `src/infra/http/dtos/class-management/eligible-students.query.spec.ts` — drop status tests

Docs to update:
- @doc/architecture/audit-trail-soft-delete-patterns — remove "Status reset" row from the isArchived table
- @doc/references/bulk-enrollment-backend-handoff — update eligible-students contract
## Open Questions

- [ ] **Q1** — Prisma `view` preview feature stability: is the cutoff Prisma version's view support stable enough for production, or should we fall back to a raw-SQL helper? (Validate during implementation; pin Prisma version in the spec).
- [ ] **Q2** — `phase` field type on the API surface: TypeScript string union (`"ACTIVE" | "WAITING" | ...`) or a new exported enum (e.g., `StudentPhase`)? Recommend exported enum for IDE ergonomics and frontend type sharing.
- [ ] **Q3** — Indexes: does `enrollment` already have an index on `(student_id, end_date)`? Same for `school_year_enrollment(student_id, exit_date)`? If missing, add to the migration.
- [ ] **Q4** — Frontend coordination: who owns the frontend cutover task? This spec lists doc updates but assumes a separate frontend spec or task picks up the consuming UI changes.
- [ ] **Q5** — Eligibility endpoint rejection mode (FR-9 / Scenario 11): hard 400 on `includeStatuses`, or silent ignore? Hard 400 makes transition issues loud; silent ignore is friendlier. Implementation chooses one.
