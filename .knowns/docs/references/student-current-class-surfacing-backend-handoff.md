---
title: Student Current-Class Surfacing Backend Handoff
description: 'Frontend gap report: `StudentResponse.class` is never populated, so the Class column on the students list and the Class stat on the student profile always render "-" / Unassigned, even for actively enrolled students. Documents the four-layer drop, lists the dead vestigial fields that should also be reconciled, and outlines design options the backend can choose between.'
createdAt: '2026-05-26T18:59:34.246Z'
updatedAt: '2026-05-26T18:59:34.246Z'
tags:
  - reference
  - handoff
  - backend
  - frontend-handoff
  - student-management
  - class-management
  - schema-drift
---

## Purpose

The frontend's students list (`/dashboard/students`) and student profile (`/dashboard/students/[id]`) try to display the student's current class, but **every row/cell falls back to "—" / "Unassigned"** — even for students who clearly have an active `Enrollment`. Root cause is server-side: `StudentResponse.class` is declared on the wire DTO but is never populated by the read path. Frontend cannot fix this without backend changes.

Audience: backend dev. This brief gathers what the frontend already verified, identifies sibling vestigial fields on the same response, and sketches three design options so backend can pick one and spec/plan independently. **No specific approach is prescribed** — pick the one that fits the broader period-model direction.

---

## What the frontend reads (and why it's empty today)

Every consumer reads `student.class?.name` from `StudentDTO`:

| File | Surface |
|---|---|
| `frontend/src/features/students/components/students-table.tsx:262-273` | Class column cell in students list. |
| `frontend/src/features/students/components/profile/student-profile-hero.tsx:85, 93-99, 115-116` | Hero descriptor + "Class" stat. |
| `frontend/src/features/students/components/profile/info-tab.tsx:133-138` | Academic section "Class" row. |
| `frontend/src/components/app-wide/link-relationship-wizard.tsx:107-108` | Student-picker disambiguator + substring searchValue. |

`StudentDTO.classId?: string` (`frontend/src/features/students/types.ts:37`) is also declared but never read.

---

## Where the data is dropped (four-layer trace)

1. **Schema** — `prisma/schema.prisma:270-330`
   - `Student` model has no `classId` column. Class membership lives only in `Enrollment[]` (period model).
   - `StudentWithPhase` view (lines 312-330) mirrors `Student` columns + derived `phase`. No `classId`, no `class` relation.

2. **Repository** — `src/infra/persistence/prisma/repositories/prisma-student.repository.ts`
   - `findById` (line 22), `findAll` (line 87), `findByCampusId` (73), `findByIds` (80) etc. all read `prisma.studentWithPhase` with **no `include`**.
   - `findEligibleForClass` already calls out that the view rejects relation includes (`Prisma rejects on a view model (no FK relations)` — line 151 comment).

3. **Mapper** — `src/infra/persistence/prisma/mapper/prisma-student.mapper.ts:14-29`
   - Explicit comment: *"Optional relation bags (`guardians`, `class`) are loaded by callers but **intentionally NOT projected** onto the domain entity."*
   - `toDomain` (line 32) hands `Student.create` only the scalar columns.

4. **Domain entity + wire DTO** — `src/domain/user-management/entities/student.entity.ts` + `src/infra/http/dtos/user-management/student/student.response.ts`
   - `Student` entity has no `class` / `classId` getter (only the props listed at `entity.ts:8-23`).
   - `StandardResponseInterceptor` walks `props` + getters → `plainToInstance(StudentResponse, …, { excludeExtraneousValues: true })`.
   - Since `class` and `classId` don't exist on the entity, the DTO's `@Expose()`-decorated fields are absent on the wire. Frontend `class?.name` short-circuits to `undefined` → renders the empty fallback.

The `StudentResponse` DTO still declares `classId`, `class`, `enrollmentDate`, and `isOnTrack` — these are leftovers from the pre-period-model schema. **All four are absent on every real GET /students and GET /students/:id payload.** The frontend `StudentDTO` shadow types let TS access them without warning, which is why this stayed quiet.

---

## Sibling vestigial fields on `StudentResponse`

While reconciling `class`, the same DTO should drop or repopulate these dead fields (no entity getters, so always `undefined` on the wire):

| Field | DTO line | Status |
|---|---|---|
| `classId: string \| null` | `student.response.ts:113` | Always missing on wire. Frontend has a matching unread `classId` field. |
| `enrollmentDate: Date \| null` | `student.response.ts:102` | Always missing on wire. No frontend reader. |
| `isOnTrack: boolean` | `student.response.ts:106` | Always missing on wire. No frontend reader. |
| `class?: ClassInfo \| null` | `student.response.ts:122-123` | Always missing on wire. Multiple frontend readers — this is the user-visible bug. |

Spec test `src/infra/http/dtos/user-management/student/student.response.spec.ts` exercises `phase` and `isArchived` exposure but doesn't assert anything about these four — that's why the drift didn't get caught.

---

## What the frontend actually needs

For the two impacted surfaces (students list + student profile), the minimum is:

- **Current class name + classId** for the student's *currently open* `Enrollment` (the row with `endDate IS NULL`).
- A consistent `null` when the student has no open enrollment (frontend already renders "Unassigned" in that case).

The frontend does **not** need full enrollment history on these surfaces — that's already served by `GET /students/:id/enrollments` and surfaced in `StudentAcademicHistoryTab`.

Per the partial-unique index `idx_enrollment_one_active_per_student ON enrollment (student_id) WHERE end_date IS NULL`, a student has at most one open enrollment, so the projection is unambiguous.

---

## Design options (pick whichever fits the broader plan)

These are sketches — backend dev owns the final shape. Trade-offs noted; no preference encoded.

### Option A — Extend the `student_with_phase` view

LEFT JOIN the open enrollment + class into the view, expose `current_class_id` and `current_class_name` (or a nested JSON column).

- **Pros:** Read path stays uniform; both `findById` and `findAll` light up automatically; no per-row N+1; mapper change is a small additive projection.
- **Cons:** Touches a Postgres view migration; needs to be careful that the join doesn't multiply rows (it won't because of the partial unique index, but explicit `LEFT JOIN LATERAL` is clearer); view becomes slightly less normalised.
- **Migration shape:** new migration that drops & re-creates `student_with_phase` (Prisma views are read-only — same pattern as the existing `20260515130000_drop_student_status_add_phase_view` migration). Add columns to the `view StudentWithPhase { … }` block.

### Option B — Drop the view route, use raw `student` with includes on these endpoints

Have `findById` and `findAll` query `prisma.student` (or a new separate view) with `include: { enrollments: { where: { endDate: null }, include: { class: { select: { id: true, name: true } } } } }`. Teach `PrismaStudentMapper` to project the optional `class` onto a new entity field.

- **Pros:** No view migration; explicit at the query site; can be done feature-by-feature.
- **Cons:** Loses `phase` projection unless you switch back to the view *and* layer the include — Prisma doesn't allow `include` on a view, so this likely means computing `phase` in two places, or keeping the view and adding a second query just for class info (extra round trip). Either way the mapper signature gets messier (`PrismaStudentRow` already carries an optional `class` bag — partially wired but not surfaced).

### Option C — Separate endpoint, no list-payload change

Add `GET /students/:id/current-enrollment` returning `{ enrollment: EnrollmentResponse | null, class: ClassInfo | null }`. Frontend calls it from the profile shell; the list keeps its current shape and the Class column shows "—" by design (or the column is dropped).

- **Pros:** Avoids touching the existing list response and the view; tightest blast radius; cheap to evolve.
- **Cons:** Doesn't solve the **list** surface (which is the most visible miss) — frontend either accepts the column stays empty, drops the column, or sends N follow-up requests per row. Generally a worse UX for the list page.

---

## Suggested cleanup (independent of option)

Whichever option you take, please consider the same PR (or a sibling chore PR) doing:

- Remove `enrollmentDate`, `isOnTrack`, and (if not repopulated) `classId` from `StudentResponse` so the wire DTO matches reality.
- If you keep `class`/`classId`, extend `student.response.spec.ts` to assert they survive the `plainToInstance` transform (the existing test pattern at lines 45-90 is a good template).
- Update Swagger annotations to reflect whatever the new shape is — current `@ApiProperty` for `class` advertises a payload that never ships.

Frontend will mirror by removing dead `classId` and tightening `StudentDTO` once the wire shape lands.

---

## Test scenarios (suggested, regardless of option)

- **Currently enrolled student** — `GET /students/:id` returns `class: { id, name }` matching the open `Enrollment` row's class.
- **Withdrawn / never-enrolled student** — `class: null`, no error.
- **List endpoint** — paginated `GET /students` returns `class` populated per row (mixed: some null, some not).
- **Phase + class interaction** — student with `phase = "ACTIVE"` always has a non-null `class`; student with any other phase has `class = null`. (This is an invariant worth asserting once.)
- **Archived student with open enrollment** — `isArchived = true`, `phase = "ACTIVE"`, `class` still populated. (Archive is orthogonal — same rule as the existing `AC-23` test.)
- **Cross-campus isolation** — student's class always belongs to the same campus as the student.

---

## References (existing files to read)

- `src/infra/persistence/prisma/repositories/prisma-student.repository.ts` — the read path that needs the projection.
- `src/infra/persistence/prisma/mapper/prisma-student.mapper.ts` — comment at lines 14-29 spells out the current "drop relations" intent.
- `src/domain/user-management/entities/student.entity.ts` — entity needs a new `class` / `classId` field if going with options A or B.
- `src/infra/http/dtos/user-management/student/student.response.ts` — DTO needs reconciliation.
- `src/infra/http/dtos/user-management/student/student.response.spec.ts` — existing spec test, good template for new assertions.
- `prisma/schema.prisma:270-330` — `Student` model + `StudentWithPhase` view.
- `prisma/migrations/20260515130000_drop_student_status_add_phase_view/migration.sql` — precedent for view migrations.
- `@doc/specs/student-status-simplification` (D6/D7) — view-as-read-path constraint that informed the current shape.

---

## Frontend follow-up once backend ships

For reference (not part of backend scope):

1. If `class` is populated on `StudentResponse`: no frontend code change needed — the existing `student.class?.name` reads light up immediately.
2. If `classId` is repopulated: frontend can drop the optional `classId?` shadow or use it directly.
3. If sibling fields (`enrollmentDate`, `isOnTrack`) are removed: frontend `StudentDTO` already doesn't carry them — nothing to do.
4. If Option C is picked: frontend wires a new `useStudentCurrentEnrollment(studentId)` hook on the profile shell and removes the Class column from the list (or accepts it stays empty).
