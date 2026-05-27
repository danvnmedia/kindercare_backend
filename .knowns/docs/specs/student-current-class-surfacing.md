---
title: Student Current-Class Surfacing
description: 'Backend schema + DTO change that surfaces the student''s currently-open enrollment class on GET /students and GET /students/:id. Extends the student_with_phase view with two derived columns, renames the populated wire field to currentClass, and removes three vestigial fields (classId, enrollmentDate, isOnTrack). Closes the gap reported in @doc/references/student-current-class-surfacing-backend-handoff.'
createdAt: '2026-05-26T23:24:47.348Z'
updatedAt: '2026-05-26T23:32:33.010Z'
tags:
  - spec
  - approved
  - backend
  - user-management
  - class-management
  - schema-change
  - frontend-handoff
---

## Overview

The frontend's students list and student profile try to render the student's current class, but `StudentResponse.class` is declared on the wire DTO and never populated — every consumer reads `student.class?.name` and falls back to "—" / "Unassigned" even for actively enrolled students. Root cause is server-side: the read path goes through the `student_with_phase` view which projects only the scalar Student columns + derived `phase`; the domain entity has no `class`/`classId` getter; and the `@Expose()`-decorated DTO fields are silently dropped by `excludeExtraneousValues`. Three sibling fields on the same DTO (`classId`, `enrollmentDate`, `isOnTrack`) are dead in the same way.

This spec adds the student's currently-open enrollment class to both impacted GET endpoints via a view extension, removes the three vestigial fields, and renames the populated wire field from `class` to `currentClass` to disambiguate from the period-model enrollment history.

Source of truth (frontend gap report): @doc/references/student-current-class-surfacing-backend-handoff. Aligned with the locked decisions in @doc/specs/student-status-simplification (D7 — view is the canonical read path for derived projections).

## Locked Decisions

- **D1** — Extend the `student_with_phase` Postgres view with `current_class_id` + `current_class_name` columns via a `LEFT JOIN LATERAL` on the open `Enrollment` (`end_date IS NULL`) joined to `class`. Both `GET /students` and `GET /students/:id` light up from one mapper change because all 7 student read paths already go through the view. (Rejected: Option B raw-table + include — fights D7 by forking the phase projection. Rejected: Option C separate endpoint — leaves the list column broken.)
- **D2** — Drop `classId: string | null`, `enrollmentDate: Date | null`, and `isOnTrack: boolean` from `StudentResponse`. None of them have entity getters today; none have current frontend readers; all are pre-period-model leftovers. The new `currentClass.id` field carries the same information `classId` would.
- **D3** — Mirror the `phase` write-path pattern: `POST /students` and `PATCH /students/:id` return `currentClass: null` regardless of the student's open-enrollment state. Writes stay on `prisma.student` (no view columns); the mapper returns `currentClass: undefined` for base-table reads, which the interceptor surfaces as `null`. No second round-trip after writes; consistent with how `phase: null` is documented today at `student.response.ts:90-97`.
- **D4** — Rename the populated wire field from `class` to `currentClass` (and the nested type from `ClassInfo` to a more specific name — final naming chosen at planning time). The `currentClass` name disambiguates from the period-model enrollment history surfaced by `GET /students/:id/enrollments`. Frontend has 4 reader sites to update (see @doc/references/student-current-class-surfacing-backend-handoff#what-the-frontend-reads).

## Requirements

### Functional Requirements

- **FR-1** — `GET /students/:id` returns `currentClass: { id, name }` when the student has exactly one open `Enrollment` row (`endDate IS NULL`), and `null` otherwise.
- **FR-2** — `GET /students` (paginated list) returns the same `currentClass` projection per row, populated from the same view columns. No N+1 follow-up reads.
- **FR-3** — `POST /students` and `PATCH /students/:id` return `currentClass: null` on the response regardless of the student's open-enrollment state, mirroring the existing `phase: null` write-path contract.
- **FR-4** — `StudentResponse` removes the declarations for `class`, `classId`, `enrollmentDate`, and `isOnTrack`. `phase`, `isArchived`, and all personal-info fields remain unchanged. Swagger schema reflects the new shape.
- **FR-5** — The `current_class_id` and `current_class_name` columns are computed by `student_with_phase` via `LEFT JOIN LATERAL` (or equivalent) on the open `Enrollment` row joined to `class`. The partial unique index `idx_enrollment_one_active_per_student ON enrollment(student_id) WHERE end_date IS NULL` guarantees at most one match per student, so the join cannot multiply rows.
- **FR-6** — The view migration preserves the existing `phase` computation byte-for-byte. The two new columns are additive.
- **FR-7** — For every student row, the projected class belongs to the same campus as the student (cross-campus isolation). This is naturally satisfied because `Enrollment` rows transitively carry the same campus FK chain, but the AC asserts it explicitly.
- **FR-8** — The `Student` domain entity gains a `currentClass: ClassSnapshot | null` prop (`{ id, name }` shape) plus a getter, mirroring the `Staff.staffType: StaffTypeSnapshot` pattern. The prop is optional in the factory (`Optional<…, "currentClass">`), defaulted to `null`.

### Non-Functional Requirements

- **NFR-1** — No N+1: the projection lives in the view at the SQL layer. List endpoints do not perform per-row class lookups.
- **NFR-2** — Migration runs in a single transaction (`BEGIN; DROP VIEW; CREATE VIEW …; COMMIT;`) following the precedent at `prisma/migrations/20260515130000_drop_student_status_add_phase_view/migration.sql`. Rollback comment block included.
- **NFR-3** — `currentClass` on the domain prop stays optional in the type, mirroring `phase?: StudentPhase`. Write-path reads from `prisma.student` surface it as `undefined` → `null` on the wire. This is intentional, not a bug.

## Acceptance Criteria

- [ ] **AC-1** — `GET /students/:id` for a student with one open `Enrollment` returns `currentClass = { id, name }` whose `id` matches that enrollment's `classId` and whose `name` matches the class's `name`.
- [ ] **AC-2** — `GET /students/:id` for a student with no open `Enrollment` (withdrawn or never-enrolled) returns `currentClass = null`. No error, no missing key.
- [ ] **AC-3** — `GET /students` paginated returns `currentClass` populated per row per AC-1/AC-2. Verified across a page containing at least one ACTIVE and one non-ACTIVE student in the same response.
- [ ] **AC-4** — `POST /students` returns `currentClass = null` and `phase = null` on the response body. `PATCH /students/:id` returns the same regardless of the student's open-enrollment state at the time of the patch.
- [ ] **AC-5** — `StudentResponse` no longer declares `class`, `classId`, `enrollmentDate`, or `isOnTrack`. Swagger `/api/docs` reflects the removal. `@ApiProperty` annotations on the new `currentClass` field document the populated-only-on-GET semantics.
- [ ] **AC-6** — Invariant: a student with `phase = 'ACTIVE'` always returns `currentClass !== null`; a student with `phase ∈ {WAITING, DEFERRED, GRADUATED, WITHDRAWN}` always returns `currentClass = null`. Asserted once via integration test against the view.
- [ ] **AC-7** — Archive orthogonality: a student with `isArchived = true` and an open `Enrollment` returns `isArchived = true`, `phase = 'ACTIVE'`, AND `currentClass = { id, name }`. Mirrors AC-23 in @doc/specs/student-status-simplification.
- [ ] **AC-8** — Cross-campus invariant: for every row in any test response, `currentClass.id`'s campus matches the student's `campusId`. Verified at least once with a multi-campus seed.
- [ ] **AC-9** — `student.response.spec.ts` is extended with two new test groups: (a) `currentClass` survives `plainToInstance` when populated, (b) `currentClass` is exposed as `null` when the source field is `null` or missing. Pattern matches the existing `phase` exposure block at lines 45-67.
- [ ] **AC-10** — Repository-level test (`prisma-student.repository.spec.ts` or equivalent integration) covers the view-projected current-class path on `findById` and `findAll` with at least one ACTIVE and one non-ACTIVE seeded student.
- [ ] **AC-11** — View migration is reversible: the rollback comment block in the migration file (template from `20260515130000_*`) recreates the prior view shape (`s.*` + phase CASE only, no current-class columns) cleanly.
- [ ] **AC-12** — `PrismaStudentRow.class?` (the unused vestigial mapper-type field at `prisma-student.mapper.ts:22`) is removed; nothing currently includes it (verified by repo grep at implementation time).

## Scenarios

### Scenario 1 — Currently enrolled student (happy path, ACTIVE)

**Given** student `S1` has one open `Enrollment` row pointing to class `C1` named "Lớp Mầm 1A" (`endDate IS NULL`)
**When** the client calls `GET /students/S1`
**Then** the response has `phase = "ACTIVE"`, `currentClass = { id: "C1", name: "Lớp Mầm 1A" }`, and `isArchived = false`.

### Scenario 2 — Withdrawn student

**Given** student `S2` has no open `Enrollment` (latest closed `SchoolYearEnrollment.exitReason = WITHDRAWN`)
**When** the client calls `GET /students/S2`
**Then** the response has `phase = "WITHDRAWN"` and `currentClass = null`. No error.

### Scenario 3 — List endpoint with mixed state

**Given** a page of 10 students containing 6 ACTIVE, 2 WAITING, 1 DEFERRED, and 1 WITHDRAWN
**When** the client calls `GET /students?limit=10`
**Then** the 6 ACTIVE rows have `currentClass !== null` and the other 4 have `currentClass = null`. No extra DB round-trips beyond the paginated view query.

### Scenario 4 — Phase + class invariant

**Given** any student `S`
**When** the response surfaces `phase` and `currentClass`
**Then** `phase === "ACTIVE"` iff `currentClass !== null`. (Equivalence enforced by the view's CASE branches sharing the same `EXISTS (open Enrollment)` predicate.)

### Scenario 5 — Archived student with open enrollment

**Given** student `S3` has `isArchived = true` AND one open `Enrollment` pointing to class `C2`
**When** the client calls `GET /students/S3`
**Then** the response has `isArchived = true`, `phase = "ACTIVE"`, and `currentClass = { id: "C2", name: <C2.name> }`. Archive overlay does not blank out the class.

### Scenario 6 — Cross-campus isolation

**Given** two campuses each with students and classes; `S4` belongs to campus `K1` with an open Enrollment to `C4` in `K1`
**When** the client (scoped to campus `K1`) calls `GET /students/S4`
**Then** `currentClass.id` is `C4` and `C4`'s campus is `K1`. No cross-campus class can ever surface.

### Scenario 7 — Write read-back returns null currentClass

**Given** student `S5` is currently ACTIVE with open Enrollment to `C5`
**When** the client calls `PATCH /students/S5` to update `phoneNumber`
**Then** the response body has `currentClass = null` and `phase = null` (consistent with the existing D7 write-path contract). A subsequent `GET /students/S5` returns `currentClass = { id: "C5", name: <C5.name> }` and `phase = "ACTIVE"`.

### Scenario 8 — New student creation

**Given** the client creates a new student `S6` via `POST /students` with no enrollment
**When** the response is returned
**Then** `currentClass = null` and `phase = null`. No enrollment is created as a side effect.

### Scenario 9 — Vestigial field removal

**Given** the new wire shape ships
**When** any GET, POST, or PATCH on `/students*` returns a `StudentResponse`
**Then** the response body has no `class` key, no `classId` key, no `enrollmentDate` key, and no `isOnTrack` key. Swagger docs do not advertise these.

## Technical Notes

### View shape sketch (planning owns final SQL)

```sql
CREATE OR REPLACE VIEW student_with_phase AS
SELECT
  s.*,
  CASE /* existing phase CASE — unchanged */ END AS phase,
  open_e.class_id        AS current_class_id,
  open_c.name            AS current_class_name
FROM student s
LEFT JOIN LATERAL (
  SELECT e.class_id
  FROM enrollment e
  WHERE e.student_id = s.id AND e.end_date IS NULL
  LIMIT 1
) open_e ON TRUE
LEFT JOIN class open_c ON open_c.id = open_e.class_id;
```

The partial unique index on `enrollment(student_id) WHERE end_date IS NULL` makes the `LIMIT 1` unambiguous; the `LEFT JOIN LATERAL` form is preferred for clarity.

### Prisma view binding

- Add `currentClassId String? @map("current_class_id") @db.Uuid` and `currentClassName String? @map("current_class_name")` to the `view StudentWithPhase` block in `prisma/schema.prisma`.
- `prisma generate` will regenerate the `StudentWithPhase` type.
- No changes to the `Student` model.

### Domain entity (snapshot pattern)

- Add `ClassSnapshot { id: string; name: string }` interface, co-located with `Student` entity. Mirrors `StaffTypeSnapshot` at `staff.entity.ts:15-18`.
- Add `currentClass: ClassSnapshot | null` to `StudentProps` + a getter on `Student`.
- Add `"currentClass"` to the `Optional<StudentProps, …>` tuple in the factory; default to `null` when absent.
- Memory reference: `do29po` (read-side snapshot projection on aggregates).

### Repository mapping

- Extend the `PrismaStudentRow` union in `prisma-student.mapper.ts:21-29` to include the two new view columns.
- Add a private `extractCurrentClass(row)` mirror of `extractPhase(row)`: narrow with `"current_class_id" in row && row.current_class_id !== null` → `{ id, name }`, else `null` (or `undefined` for raw-table reads, surfaced as `null`).
- Remove the now-unused `class?: PrismaClass | null` field from `PrismaStudentRow` (verified unused by grep — see AC-12).
- Memory reference: `p323sd` (Prisma view binding for derived/computed projections).

### Migration template

Follow `prisma/migrations/20260515130000_drop_student_status_add_phase_view/migration.sql`:

```
BEGIN;
  DROP VIEW IF EXISTS "student_with_phase";
  CREATE VIEW "student_with_phase" AS …;  -- new shape with current_class_* columns
COMMIT;

-- ROLLBACK (manual):
-- BEGIN;
--   DROP VIEW IF EXISTS "student_with_phase";
--   CREATE VIEW "student_with_phase" AS …;  -- prior shape, phase only
-- COMMIT;
```

### Test coverage seam

- DTO surface: extend `src/infra/http/dtos/user-management/student/student.response.spec.ts`. Existing pattern at lines 45-90 is the template — new `describe("currentClass exposure", …)` block covering present + null cases.
- Repository surface: extend (or create) `prisma-student.repository.spec.ts` to cover the view projection for both `findById` and `findAll`.
- Invariant (AC-6): one integration test asserting `phase === "ACTIVE"` ⇔ `currentClass !== null`.

### Frontend follow-up (out of scope; tracked in handoff)

- Rename 4 reader sites: `student.class?` → `student.currentClass?` (paths listed in @doc/references/student-current-class-surfacing-backend-handoff#what-the-frontend-reads).
- Drop the unread `classId` shadow field from `StudentDTO` (`frontend/src/features/students/types.ts:37`).
- Update the nested DTO type name in `StudentDTO` to match the new backend type name.

## Open Questions

- **OQ-1** — Should the `currentClass` snapshot also carry the open Enrollment's `enrollmentDate` (e.g., `currentClass: { id, name, enrolledSince }`)? Currently no frontend reader, but the view already touches the row so it's almost free. Defer until FE asks; the snapshot is easy to extend additively later.
- **OQ-2** — Final naming for the nested DTO type — `CurrentClassInfo`, `ClassSummary`, or reuse `ClassInfo` (renamed)? Planning to decide; doesn't affect the view or domain shape. Existing precedent: `StaffTypeSummaryDto` at `src/infra/http/dtos/user-management/staff-type/staff-type-summary.dto.ts` (per memory `do29po`).
- **OQ-3** — Does any consumer beyond the 4 sites named in the handoff read `StudentResponse.class`? Quick grep at implementation time should confirm. Spec assumes 4 sites is the full count.
