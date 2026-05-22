---
title: Class Enrollment Period Model
description: Backend schema, domain, and HTTP refactor that models enrollment as a period (start + optional end + exit reason), preserving full history of student class membership across transfers, withdrawals, and year-over-year movement. Foundation for class-profile-page and bulk-enrollment specs.
createdAt: '2026-05-05T02:40:56.388Z'
updatedAt: '2026-05-05T02:50:29.553Z'
tags:
  - spec
  - draft
  - backend
  - class-management
  - enrollment
  - schema-change
---

## Overview

Today's `Enrollment` row records only when a student joined a class — there is no exit date, no exit reason, and the unenroll endpoint hard-deletes the row (`prisma-class.repository.ts:169`). As a result the system cannot answer questions a kindergarten genuinely needs to answer:

- *"Was Lê C in Lớp Mầm A1 last year?"* — only by coincidence (different `classId` per year).
- *"When did Trần B transfer out of A1 into B1?"* — impossible; the transfer event is destroyed when the old row is deleted.
- *"How many students are currently in this class?"* — ambiguous, because the schema lets the same `(studentId, classId)` exist on multiple `enrollmentDate`s with no semantic meaning, and no marker for "currently active."

This spec refactors the backend so enrollment is a *period* with a start date, an optional end date, and an exit reason. "Withdraw" and "transfer" replace the destructive "delete" verb. A database-level partial unique index enforces "one active class per student at a time." All historical data is preserved by default.

This unblocks the future class-profile-page spec (whose `studentCount` and active-roster semantics depend on a coherent model) and the future bulk-enrollment spec, both of which are explicitly out of scope here.

## Locked Decisions

- **D1 — Period model.** Enrollment becomes `(start, optional end, optional reason)`. The existing PK `(studentId, classId, enrollmentDate)` is unchanged so a student can have multiple periods in the same class over time (e.g. withdrawn, returned later). The active period is defined by `endDate IS NULL`.
- **D2 — One active enrollment per student, DB-enforced.** A partial unique index `enrollment(student_id) WHERE end_date IS NULL` enforces "a kid is in at most one class right now." Domain rule for kindergarten; DB-enforced beats convention-enforced.
- **D3 — Withdraw, don't delete.** The destructive `DELETE /classes/:classId/enrollments/:enrollmentId` is removed in favor of `POST /classes/:classId/enrollments/:enrollmentId/withdraw` taking a body. The row is *closed* (endDate set, exitReason set), never deleted, even when the user-facing label remains "Unenroll." Hard delete is reserved for accidental data entry and exposed via a separate admin endpoint (out of scope here).
- **D4 — Transfer is atomic and explicit.** Mid-year transfer is a first-class operation: `POST /students/:studentId/transfer { toClassId, transferDate?, fromClassId?, note? }`. The backend closes the active period (`endDate=transferDate, exitReason=TRANSFERRED`) and opens a new period in `toClassId` in the same transaction. Calling withdraw + enroll separately is allowed but is two distinct user actions and lacks the `TRANSFERRED` exit-reason tagging.
- **D5 — Exit reasons are a fixed enum, not a lookup table.** Values: `TRANSFERRED | WITHDRAWN | COMPLETED | GRADUATED`. Adding new reasons is a code change. Lookup-table flexibility isn't worth the schema/admin overhead for four values.
- **D6 — Active by default; history is opt-in.** `GET /classes/:id/enrollments` returns active rows only (`endDate IS NULL`). `?includeHistorical=true` returns everything. New `GET /students/:id/enrollments` returns full history (the student profile is the natural home for the timeline).
- **D7 — Exit reason vs. student status are separate axes.** A student withdrawn from a class is *not* automatically `Student.status = DROPPED`. A transfer leaves student status `ACTIVE`. Status mutations are the caller's responsibility (e.g. the eventual frontend can prompt to set `DROPPED` when the user picks `WITHDRAWN`).
- **D8 — Backfill is deterministic and reversible, with hard-fail on conflict.** Existing rows: each `(studentId, classId)` group becomes a chain of consecutive periods sorted by `enrollmentDate`. Each non-latest row gets `endDate = next row's enrollmentDate - 1 day`, `exitReason = COMPLETED`. The latest row stays open (`endDate = null`). If any student has rows in multiple classes simultaneously active under the new rules, the migration **aborts with a printed conflict report** — sysadmin reconciles manually before re-running. No silent best-effort fixes.
- **D9 — Future endDate is rejected.** `endDate` and `transferDate` cannot be set to a date later than today. If a school wants to schedule a withdrawal, that's a different feature (out of scope). Keeps "active = endDate IS NULL" valid as a query without a time-zone-sensitive `WHERE endDate IS NULL OR endDate > today` clause.
- **D10 — Wire-incompatible by design.** The frontend was never coupled to the `DELETE` semantics in production (no class profile page exists yet, no enrollment UI in production). Change the verb cleanly rather than dual-route. Existing tests for `UnenrollStudentUseCase` are replaced as part of this change.

## Requirements

### Functional Requirements

**Schema**
- **FR-1**: `enrollment` table gains `end_date date null` and `exit_reason text null` columns. The domain `Enrollment` entity gains `endDate: Date | null` and `exitReason: ExitReason | null` properties.
- **FR-2**: A partial unique index `idx_enrollment_one_active_per_student` enforces uniqueness on `student_id WHERE end_date IS NULL`. A student can be active in at most one class at a time.
- **FR-3**: `ExitReason` enum is added with values `TRANSFERRED | WITHDRAWN | COMPLETED | GRADUATED`. Validated via class-validator on the wire and at the domain entity.

**Domain**
- **FR-4**: `Enrollment.isActive()` returns true iff `endDate === null`.
- **FR-5**: `Enrollment.withdraw(endDate, reason)` returns a new entity instance with the period closed; throws `EnrollmentAlreadyClosedError` if already closed and `InvalidEndDateError` if `endDate < enrollmentDate` or `endDate > today`.
- **FR-6**: Domain invariant: an `Enrollment` with non-null `exitReason` must also have a non-null `endDate`, and vice versa. Constructing with one but not the other throws.

**Use cases — replaced**
- **FR-7**: `UnenrollStudentUseCase` is removed. `WithdrawStudentUseCase` replaces it: takes `(enrollmentId, campusId, endDate?, reason)`. Default `endDate` is today. Errors: `ENROLLMENT_NOT_FOUND`, `ENROLLMENT_ALREADY_CLOSED`, `INVALID_END_DATE`.
- **FR-8**: `EnrollStudentUseCase` rejects enrollment if the student has an existing active enrollment in *any* class (not just the same class). Error: `STUDENT_ALREADY_ENROLLED`. To enroll into a different class, the caller must call transfer or withdraw first.
- **FR-9**: `GetClassEnrollmentsUseCase` filters `endDate IS NULL` by default. Accepts `includeHistorical: boolean = false`. When true, returns all rows ordered by `enrollmentDate DESC`.

**Use cases — new**
- **FR-10**: `TransferStudentUseCase` takes `(studentId, toClassId, campusId, transferDate?, note?, fromClassId?)`. Inside a single transaction it closes the student's active enrollment with `exitReason=TRANSFERRED, endDate=transferDate` and inserts a new enrollment with `enrollmentDate=transferDate`. Default `transferDate` is today. Errors: `NO_ACTIVE_ENROLLMENT`, `TRANSFER_SAME_CLASS`, `TRANSFER_SOURCE_MISMATCH` (if `fromClassId` provided and doesn't match active), `INVALID_TRANSFER_DATE`.
- **FR-11**: `GetStudentEnrollmentHistoryUseCase` returns all enrollment rows for a student ordered by `enrollmentDate DESC`. Each row includes `class.name`, `class.schoolYear.name`, `class.gradeLevel.name`, `endDate`, `exitReason`. Used by the future student-profile "Class history" surface; ships in this phase so the API is settled before any UI consumes it.

**HTTP — replaced**
- **FR-12**: `DELETE /classes/:classId/enrollments/:enrollmentId` is removed. Replaced by `POST /classes/:classId/enrollments/:enrollmentId/withdraw` with body `{ reason: ExitReason; endDate?: ISODate; note?: string }`. Returns the updated `EnrollmentResponse`.
- **FR-13**: `GET /classes/:id/enrollments` accepts a new query param `includeHistorical: boolean = false`. Returned rows include `endDate` and `exitReason` regardless of the flag.

**HTTP — new**
- **FR-14**: `POST /students/:studentId/transfer` with body `{ toClassId: UUID; transferDate?: ISODate; fromClassId?: UUID; note?: string }`. Returns `{ closed: EnrollmentResponse, opened: EnrollmentResponse }`.
- **FR-15**: `GET /students/:studentId/enrollments` returns the student's full enrollment history.

**Response shapes**
- **FR-16**: `EnrollmentResponse` gains `endDate: Date | null` and `exitReason: ExitReason | null`. All endpoints that return `EnrollmentResponse` populate these.

**Date bounds (school year)**
- **FR-17**: `enrollmentDate` (on enroll) and `transferDate` (on transfer) must lie within `[class.schoolYear.startDate, class.schoolYear.endDate]` for the target class. Out-of-range dates are rejected with `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR` (400). The validation runs after campus-scope checks but before persistence; for transfer, the bound is checked against the *target* class's school year, not the source's.

### Non-Functional Requirements

- **NFR-1**: Migration is reversible. The down migration drops the partial index and the two columns. Active rows are unaffected on rollback; closed rows lose their `endDate`/`exitReason` (acceptable — rolling back means abandoning the model entirely).
- **NFR-2**: Migration aborts loudly on conflict (a student with simultaneous active enrollments in multiple classes). The conflict report is written to stdout in the form `studentId | classIds | enrollmentDates`. The schema change is rolled back.
- **NFR-3**: All new endpoints respect the existing campus interceptor (`X-Campus-Id` header). No `campusId` in request bodies.
- **NFR-4**: Atomic transfer must run inside a single Prisma transaction (`prisma.$transaction(async (tx) => ...)`). Close and open succeed or fail together — no half-state.
- **NFR-5**: All new errors use the project's existing `DomainException` hierarchy and map to standard HTTP codes: 400 (validation: `INVALID_END_DATE`, `INVALID_TRANSFER_DATE`, `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`), 404 (`ENROLLMENT_NOT_FOUND`, cross-campus access), 409 (`ENROLLMENT_ALREADY_CLOSED`, `STUDENT_ALREADY_ENROLLED`, `NO_ACTIVE_ENROLLMENT`, `TRANSFER_SAME_CLASS`, `TRANSFER_SOURCE_MISMATCH`).
- **NFR-6**: Existing tests for `EnrollStudentUseCase` and the removed `UnenrollStudentUseCase` are updated or replaced. New tests cover withdraw, transfer (happy path + every conflict case), the partial unique index (insert two `endDate IS NULL` rows for one student must fail), and the migration backfill against a representative seed.
- **NFR-7**: Schema changes ship in one Prisma migration, not split. Reduces the half-migrated production-state surface.
- **NFR-8**: `EnrollmentResponse` shape change is additive only (two new optional fields). Any existing consumer that ignores unknown fields is unaffected.

## Acceptance Criteria

**Schema + migration**
- [ ] **AC-1**: Running the migration on a clean database adds `end_date date`, `exit_reason text` columns and the partial unique index `idx_enrollment_one_active_per_student`. `\d enrollment` reflects the new shape.
- [ ] **AC-2**: Running the migration against existing seed/staging data succeeds, preserves all rows, and sets `endDate IS NULL` on the latest row of each `(studentId, classId)` group.
- [ ] **AC-3**: Running the migration against synthetic data with a conflict (one student active in two classes simultaneously) aborts with a printed conflict report and leaves the database unchanged.
- [ ] **AC-4**: Inserting two rows with the same `studentId` and `endDate IS NULL` raises a unique-constraint violation.

**Domain**
- [ ] **AC-5**: `Enrollment.isActive()` returns `true` for `endDate=null`, `false` for any non-null `endDate`.
- [ ] **AC-6**: `Enrollment.withdraw(date, reason)` returns a new entity with `endDate=date, exitReason=reason`. Calling it on an already-closed entity throws `EnrollmentAlreadyClosedError`.
- [ ] **AC-7**: Constructing an `Enrollment` with `endDate` set but `exitReason` null (or vice versa) throws an invariant error.
- [ ] **AC-8**: `Enrollment.withdraw(date, reason)` with `date < enrollmentDate` or `date > today` throws `InvalidEndDateError`.

**Withdraw**
- [ ] **AC-9**: `POST /classes/<classId>/enrollments/<enrollmentId>/withdraw { reason: "WITHDRAWN" }` closes the period with `endDate=today` and returns the updated `EnrollmentResponse` containing `endDate` and `exitReason: "WITHDRAWN"`.
- [ ] **AC-10**: Calling withdraw twice on the same enrollment returns `409 ENROLLMENT_ALREADY_CLOSED` on the second call.
- [ ] **AC-11**: Withdraw with body `{ reason: "WITHDRAWN", endDate: "2026-03-12" }` honors the supplied date.
- [ ] **AC-12**: Withdraw with `endDate` in the future or before `enrollmentDate` returns `400 INVALID_END_DATE`.
- [ ] **AC-13**: Withdraw on an enrollment whose class belongs to a different campus returns `404`.

**Transfer**
- [ ] **AC-14**: `POST /students/<studentId>/transfer { toClassId: "<classB>" }` on a student currently active in `<classA>` returns `200` with `{ closed, opened }`. `closed.classId === <classA>`, `closed.exitReason === "TRANSFERRED"`. `opened.classId === <classB>`, `opened.endDate === null`.
- [ ] **AC-15**: Transfer with a custom `transferDate` sets both `closed.endDate` and `opened.enrollmentDate` to that date.
- [ ] **AC-16**: Transfer where `toClassId` matches the student's active class returns `409 TRANSFER_SAME_CLASS`.
- [ ] **AC-17**: Transfer with `fromClassId` not matching the active class returns `409 TRANSFER_SOURCE_MISMATCH`.
- [ ] **AC-18**: Transfer for a student with no active enrollment returns `409 NO_ACTIVE_ENROLLMENT`.
- [ ] **AC-19**: Transfer with `transferDate` in the future or before the active enrollment's `enrollmentDate` returns `400 INVALID_TRANSFER_DATE`.
- [ ] **AC-20**: Transfer fails atomically — if the new-row insert fails, the original close is rolled back. The active row remains `endDate=null`.

**Enroll**
- [ ] **AC-21**: `POST /classes/<classId>/enrollments` for a student already active in any class returns `409 STUDENT_ALREADY_ENROLLED`.
- [ ] **AC-22**: After withdraw, enrolling the same student in any class succeeds.

**Reads**
- [ ] **AC-23**: `GET /classes/<id>/enrollments` returns only `endDate IS NULL` rows by default.
- [ ] **AC-24**: `GET /classes/<id>/enrollments?includeHistorical=true` returns all rows for the class, sorted by `enrollmentDate DESC`.
- [ ] **AC-25**: `GET /students/<id>/enrollments` returns the student's full history with `class.name`, `class.schoolYear.name`, `class.gradeLevel.name`, `endDate`, `exitReason` populated.
- [ ] **AC-26**: `EnrollmentResponse` consistently includes `endDate` and `exitReason` across all read endpoints.

**Date bounds (school year)**
- [ ] **AC-27**: `POST /classes/<classId>/enrollments` with `enrollmentDate` outside `[class.schoolYear.startDate, class.schoolYear.endDate]` returns `400 ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`. No row is created.
- [ ] **AC-28**: `POST /students/<studentId>/transfer` with `transferDate` outside the target class's school-year range returns `400 ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`. No mutation occurs (the active row remains open).

## Scenarios

### Scenario 1 — Mid-year transfer (happy path)
**Given** student Lê C is currently enrolled in Lớp Mầm A1 (started 2024-09-01, endDate=null).
**When** the user calls `POST /students/<lec>/transfer { toClassId: <a2>, transferDate: "2025-03-15" }`.
**Then** the response contains `closed: { classId: <a1>, endDate: "2025-03-15", exitReason: "TRANSFERRED" }` and `opened: { classId: <a2>, enrollmentDate: "2025-03-15", endDate: null }`. Both rows persist. `GET /students/<lec>/enrollments` returns both, ordered by start date DESC.

### Scenario 2 — Withdraw mid-year (happy path)
**Given** student Trần B is currently enrolled in Lớp Mầm A1.
**When** the user calls `POST /classes/<a1>/enrollments/<eid>/withdraw { reason: "WITHDRAWN", endDate: "2025-04-10" }`.
**Then** the row is closed (`endDate=2025-04-10, exitReason=WITHDRAWN`). `GET /classes/<a1>/enrollments` (default) no longer lists Trần B. `GET /classes/<a1>/enrollments?includeHistorical=true` lists the closed row. `GET /students/<trb>/enrollments` lists the closed row.

### Scenario 3 — Year-over-year movement (happy path)
**Given** Lê C completed school year 2024-2025 in Lớp Mầm A1; the row is closed `endDate=2025-06-30, exitReason=COMPLETED` (closed by an end-of-year administrative action — *automating* this is out of scope here, but the data shape supports it).
**When** at the start of 2025-2026 the user enrolls Lê C in Lớp Chồi A1 (a different class entity).
**Then** the new row inserts cleanly (no conflict, since the previous row is closed). `GET /students/<lec>/enrollments` returns both, oldest last.

### Scenario 4 — Re-enroll after withdrawal in the same class (edge case)
**Given** Lê C was withdrawn from Lớp Mầm A1 on 2025-04-10.
**When** at the start of 2025-2026 the user enrolls Lê C back in Lớp Mầm A1 with `enrollmentDate: "2025-09-01"`.
**Then** a *second* row is created for `(student=lec, class=a1)` with the new start date. The `(studentId, classId, enrollmentDate)` composite key permits this. The closed row stays untouched. The active-per-student partial unique index does not trip because the closed row has `endDate IS NOT NULL`.

### Scenario 5 — Same-class transfer rejection (edge case)
**Given** Lê C is currently in Lớp Mầm A1.
**When** the user calls `POST /students/<lec>/transfer { toClassId: <a1> }`.
**Then** the API returns `409 TRANSFER_SAME_CLASS`. No rows change.

### Scenario 6 — Withdraw twice (edge case)
**Given** an enrollment row is already closed with `endDate=2025-04-10`.
**When** the user calls withdraw on the same `enrollmentId`.
**Then** the API returns `409 ENROLLMENT_ALREADY_CLOSED`. No rows change.

### Scenario 7 — Migration with conflicting data (edge case)
**Given** a database where student Lê C has two rows with `endDate IS NULL` (one in class A1, one in class B1) — invalid under the new model.
**When** the migration runs.
**Then** it prints `CONFLICT: studentId=<lec> simultaneously active in classIds=[<a1>,<b1>] enrollmentDates=[2024-09-01, 2025-01-15]` and aborts. No schema change is applied; the database is unchanged.

### Scenario 8 — Atomic transfer failure (edge case)
**Given** a student Lê C is active in A1, and class B1's `gradeLevel` has just been archived by another transaction (hypothetical FK validation failure).
**When** the user calls transfer to B1, and the new-row insert fails the validator.
**Then** the close on A1 is rolled back; A1's row remains `endDate=null`. The API surfaces the underlying error. No half-state.

### Scenario 9 — Enroll while already active (edge case)
**Given** Lê C is currently active in Lớp Mầm A1.
**When** the user calls `POST /classes/<b1>/enrollments { studentId: <lec>, enrollmentDate: today }`.
**Then** the API returns `409 STUDENT_ALREADY_ENROLLED`. The caller must use transfer (atomic) or withdraw + enroll (two steps).

### Scenario 10 — Enrollment date outside school year (edge case)
**Given** Lớp Mầm A1 has school year 2024-2025 with `startDate=2024-09-01, endDate=2025-06-30`.
**When** the user calls `POST /classes/<a1>/enrollments { studentId: <lec>, enrollmentDate: "2025-08-15" }`.
**Then** the API returns `400 ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`. No row is created. Same outcome for a transfer whose `transferDate` falls outside the *target* class's school year.

### Scenario 11 — Same-day transfer creates zero-day period (edge case)
**Given** Lê C was enrolled in Lớp Mầm A1 today by mistake (`enrollmentDate=today`).
**When** the user calls `POST /students/<lec>/transfer { toClassId: <correct>, transferDate: today }`.
**Then** the original row is closed with `endDate=today, exitReason=TRANSFERRED` (a zero-day period) and a new row opens in the correct class. Both rows persist. Reports treating "in class on date X" as `enrollmentDate ≤ X < endDate` correctly skip zero-day periods.

## Technical Notes

### Migration shape

One Prisma migration: `add_enrollment_period_columns`. Steps in order, all inside one transaction:

1. `ALTER TABLE enrollment ADD COLUMN end_date DATE NULL;`
2. `ALTER TABLE enrollment ADD COLUMN exit_reason TEXT NULL;`
3. **Backfill** via window function:
   ```sql
   WITH ranked AS (
     SELECT id,
            student_id,
            class_id,
            enrollment_date,
            LEAD(enrollment_date) OVER (PARTITION BY student_id, class_id ORDER BY enrollment_date) AS next_start
     FROM enrollment
   )
   UPDATE enrollment e
   SET end_date    = ranked.next_start - INTERVAL '1 day',
       exit_reason = 'COMPLETED'
   FROM ranked
   WHERE e.id = ranked.id AND ranked.next_start IS NOT NULL;
   ```
4. **Conflict detection** (must run before creating the partial unique index):
   ```sql
   SELECT student_id, array_agg(class_id), array_agg(enrollment_date)
   FROM enrollment
   WHERE end_date IS NULL
   GROUP BY student_id
   HAVING count(*) > 1;
   ```
   If rowcount > 0, `RAISE EXCEPTION 'CONFLICT: ...'` with the report and let the transaction roll back.
5. `CREATE UNIQUE INDEX idx_enrollment_one_active_per_student ON enrollment (student_id) WHERE end_date IS NULL;`

Down migration drops the index and the two columns.

### Repository changes

`EnrollmentRepository` port (`src/application/class-management/ports/enrollment.repository.ts`):
- Add `findActiveByStudentId(studentId): Promise<Enrollment | null>`.
- Add `findActiveByClassId(classId): Promise<Enrollment[]>` *or* keep `findByClassId` and pass an `activeOnly: boolean` param — call out in implementation.
- Add `findHistoricalByClassId(classId): Promise<Enrollment[]>`.
- Add `findAllByStudentId(studentId): Promise<Enrollment[]>` (history).
- Remove `delete` and `deleteByStudentAndClass` (no callers after this spec).

`PrismaEnrollmentRepository`:
- Updates existing `findByClassId` query to add `where: { endDate: null }` and adds the new methods.

### Use case ownership

- `WithdrawStudentUseCase` lives in `application/class-management/use-cases/enrollment/`.
- `TransferStudentUseCase` lives in `application/class-management/use-cases/enrollment/`. Internally it composes withdraw + enroll inside a single Prisma transaction (`prisma.$transaction(async tx => ...)`).
- `GetStudentEnrollmentHistoryUseCase` lives in `application/class-management/use-cases/enrollment/` even though it's keyed on student, since it operates on the enrollment aggregate.

### HTTP wiring

- `class.controller.ts` loses the `DELETE :classId/enrollments/:enrollmentId` route and gains `POST :classId/enrollments/:enrollmentId/withdraw`.
- A new `student-enrollment.controller.ts` (or a focused extension to the existing `student.controller.ts`) hosts:
  - `POST /students/:studentId/transfer`
  - `GET /students/:studentId/enrollments`
- `class-management.module.ts` provides the new use cases and removes the old `UnenrollStudentUseCase`.

### Error codes (additions / changes)

| Code | HTTP | Meaning |
|---|---|---|
| `ENROLLMENT_ALREADY_CLOSED` | 409 | Withdraw called on an already-closed enrollment |
| `STUDENT_ALREADY_ENROLLED` | 409 | Enroll attempted while student has any active enrollment (broadened from "already in same class") |
| `TRANSFER_SAME_CLASS` | 409 | Transfer target equals current active class |
| `TRANSFER_SOURCE_MISMATCH` | 409 | Provided `fromClassId` doesn't match active enrollment |
| `NO_ACTIVE_ENROLLMENT` | 409 | Transfer attempted for student with no active enrollment |
| `INVALID_END_DATE` | 400 | `endDate` is in the future or before `enrollmentDate` |
| `INVALID_TRANSFER_DATE` | 400 | `transferDate` is in the future or before active enrollment's start |
| `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR` | 400 | `enrollmentDate` or `transferDate` outside the target class's school-year range |

### Prisma schema diff (illustrative)

```prisma
model Enrollment {
  id              String       @id @default(uuid()) @db.Uuid
  classId         String       @map("class_id") @db.Uuid
  studentId       String       @map("student_id") @db.Uuid
  enrollmentDate  DateTime     @map("enrollment_date") @db.Date
  endDate         DateTime?    @map("end_date") @db.Date
  exitReason      String?      @map("exit_reason")
  note            String?

  class   Class   @relation(fields: [classId], references: [id], onDelete: Restrict)
  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@unique([studentId, classId, enrollmentDate])
  @@index([classId])
  @@index([studentId])
  @@index([enrollmentDate])
  // partial unique index added via raw SQL in migration:
  // CREATE UNIQUE INDEX idx_enrollment_one_active_per_student
  //   ON enrollment (student_id) WHERE end_date IS NULL;
  @@map("enrollment")
}
```

Note: Prisma does not natively express partial unique indexes — apply via `Unsafe` raw SQL in the same migration.

### Out of scope (explicit)

- `studentCount` and `teachers[]` enrichment on `ClassResponse` — covered by the future class-profile-page spec. When that ships, the `_count` filter must be `where: { endDate: null }` to count active enrollments only.
- Bulk enrollment endpoint — covered by future bulk-wizard spec.
- "Unassigned" student filter — covered by future bulk-wizard spec; trivially supported once this spec lands (`students with no enrollment row WHERE class.schoolYearId = current AND endDate IS NULL`).
- Frontend changes (hooks, services, UI). All frontend enrollment work stalls until this spec ships, but the changes themselves belong to the frontend specs that consume this model.
- Hard-delete admin endpoint for accidental enrollments. Add when an actual operational need surfaces.
- End-of-school-year auto-close cron. Operationally desirable (closes all open enrollments whose class's school year ended), but orthogonal to the model. Add later when ready.
- Soft-delete / archive on the closed rows. Closed enrollments live forever by design — that's the whole point.

## Open Questions

*None — all initial questions resolved 2026-05-04. See **## Resolved** below.*

## Resolved

- **Status auto-cascade (resolved 2026-05-04).** Withdraw does not auto-cascade to `Student.status`. The API stays independent of student status (D7). The consuming UI **soft-prompts** the operator to set `Student.status = DROPPED` when they pick `exitReason = WITHDRAWN`; the prompt is dismissable and editable in either direction. UI-only concern, captured here to prevent re-litigation.
- **Backfill exit reason (resolved 2026-05-04).** Migration uses uniform `COMPLETED` for backfilled closed rows. No production data exists at migration time, so historical fidelity isn't a concern; the choice is documented purely so a future operator understands what backfilled `COMPLETED` rows actually mean.
- **History pagination (resolved 2026-05-04).** `GET /students/:id/enrollments` returns all rows unpaginated. Bounded by domain (a kindergartener accumulates at most ~5 enrollment rows in their lifetime). Revisit only if a longitudinal-reporting feature surfaces large per-student histories.
- **Same-day transfer / zero-day periods (resolved 2026-05-04).** Same-day transfer remains valid. The closed row gets `endDate === enrollmentDate` (zero-day period) and is preserved as an audit record. Reporting/membership queries must use the convention `enrollmentDate ≤ date < endDate` (or `endDate IS NULL`) to correctly skip zero-day periods when computing class membership; documented as a project-wide query convention.
- **Enrollment date bounds (resolved 2026-05-04).** `enrollmentDate` (on enroll) and `transferDate` (on transfer) must lie within `[class.schoolYear.startDate, class.schoolYear.endDate]` for the target class. Out-of-range rejected with `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR` (400). FR-17, AC-27, AC-28, Scenario 10 added; error code table updated; NFR-5 extended.
