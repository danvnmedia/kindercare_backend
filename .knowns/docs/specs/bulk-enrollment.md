---
title: Bulk Enrollment
description: 'Backend spec for the v1 bulk-enrollment wizard: bulk-enroll, eligible-students filter, and bulk-transfer endpoints. Builds on the period-model foundation; supersedes the bulk-enrollment-backend-handoff reference doc on any conflict.'
createdAt: '2026-05-10T19:30:51.252Z'
updatedAt: '2026-05-10T19:36:06.696Z'
tags:
  - spec
  - approved
  - backend
  - class-management
  - enrollment
  - bulk
---

## Overview

Adds three bulk endpoints to the class-management module so the frontend bulk-enrollment wizard can enroll, transfer, and pre-filter students at scale without firing N parallel HTTP calls and reconciling partial failures client-side.

In scope (v1):
- `POST /classes/:id/enrollments/bulk` — enroll N students into one class on one date.
- `GET /classes/:classId/eligible-students` — paginated list of students at the class's campus who are not currently enrolled anywhere.
- `POST /classes/:id/transfers/bulk` — transfer N students into one target class; each `(close + open)` runs in its own DB transaction.

Foundation: @doc/specs/class-enrollment-period-model (period model, partial unique active index, single-row use cases).

Reference: @doc/references/bulk-enrollment-backend-handoff (frontend's gap analysis & contract sketch — superseded by this spec for any conflict).

Out of scope (deferred):
- Bulk staff assignment.
- Frontend wizard implementation, hooks, services, UI.
- Centralizing the existing single-row error codes (only the new bulk codes are centralized — see D4).
- Normalizing `EnrollStudentUseCase`'s 400 cross-campus-class response to 404 (D5 leaves this untouched).

## Locked Decisions

- **D1**: v1 scope = bulk-enroll + eligible-students + bulk-transfer. Bulk-staff is deferred to a separate spec when a parallel staff-bulk wizard is on the roadmap.
- **D2**: Eligible-students predicate is implemented as a dedicated `StudentRepository.findEligibleForClass(classId, params, scope?)` method. The Prisma impl builds the `NOT EXISTS` (or equivalent) WHERE clause and still routes through `PrismaQueryService.executeQuery` for pagination, sort, and search.
- **D3**: Bulk-enroll persistence runs all post-validation survivors inside a single `prisma.$transaction` via a new `EnrollmentRepository.saveMany(enrollments)`. Mirrors the `saveManySummariesWithLogs` precedent. A DB-level error inside the transaction rolls back the entire batch.
- **D4**: Only the new bulk-only error codes are centralized in a new module `src/application/class-management/enrollment-error-codes.ts`. Existing single-row codes (`STUDENT_ALREADY_ENROLLED`, `NO_ACTIVE_ENROLLMENT`, `TRANSFER_SAME_CLASS`, `TRANSFER_SOURCE_MISMATCH`, `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`) stay inline. New module exports: `BATCH_TOO_LARGE`, `BATCH_EMPTY`, `DUPLICATE_STUDENT_IN_BATCH`, `STUDENT_NOT_FOUND`, `STUDENT_NOT_IN_CAMPUS`, `ENROLLMENT_ALREADY_EXISTS_ON_DATE`.
- **D5**: Cross-campus class lookups for the new bulk endpoints return `404 NotFoundException("Class with ID … not found")`, matching the newer `TransferStudentUseCase` / `GetClassEnrollmentsUseCase` AC-13 convention. The older `EnrollStudentUseCase`'s 400 behavior is intentionally left untouched in this spec.
- **D6**: Eligible-students default `includeStatuses=ACTIVE`. Caller may opt in to `WAITING`, `TRIAL`, `DEFERRED`. `DROPPED` and `GRADUATED` are hard-blocked at the DTO layer regardless of the request value. Eligibility additionally requires `isArchived === false`.
- **D7**: Bulk-transfer atomicity unit = one row. Each `(close + open)` pair runs in its own `enrollmentRepository.transferEnrollment` transaction. Partial-batch success is allowed and expected. **This is intentionally different from bulk-enroll's atomicity unit (one whole call)** — the asymmetry exists because a transfer is two writes per row that must stay atomic together, while enroll is one write per row.
- **D8**: URL shapes:
  - `POST /classes/:id/enrollments/bulk`
  - `GET /classes/:classId/eligible-students`
  - `POST /classes/:id/transfers/bulk`
- **D9**: Per-row tolerant pattern (mirror `bulk-record-attendance.use-case`): whole-call validation failures return HTTP 4xx with no row work performed; per-row validation failures return HTTP 200 with the failing rows in `skipped[]` carrying a stable machine code in `reason` and an optional human-readable `message`.
- **D10**: Batch limits: `students[]` capped at 100 per call; empty array → 400 `BATCH_EMPTY`; duplicate `studentId` in payload → 400 `DUPLICATE_STUDENT_IN_BATCH`. These are checked before any per-row work.

## Requirements

### Functional Requirements

**Bulk enroll**
- **FR-1**: `POST /classes/:id/enrollments/bulk` accepts `{ enrollmentDate, note?, students: [{ studentId, note? }] }` and returns `{ enrolled: EnrollmentResponse[], skipped: [{ studentId, reason, message? }] }`.
- **FR-2**: `enrollmentDate` is batch-level (single date for the whole submission). Per-row `note` overrides the batch-level `note` when set; an omitted per-row `note` inherits the batch-level `note`.
- **FR-3**: Whole-call validation runs in this order, short-circuiting on first failure: (a) `BATCH_EMPTY`; (b) `BATCH_TOO_LARGE`; (c) `DUPLICATE_STUDENT_IN_BATCH`; (d) class exists & in campus (else 404); (e) `enrollmentDate` within `class.schoolYear` range (else 400 `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`). Any failure aborts before per-row work.
- **FR-4**: Per-row validation runs in this order: (a) `STUDENT_NOT_FOUND`; (b) `STUDENT_NOT_IN_CAMPUS`; (c) `STUDENT_ALREADY_ENROLLED`; (d) `ENROLLMENT_ALREADY_EXISTS_ON_DATE`. First failure pushes the row to `skipped[]` and continues with the next row.
- **FR-5**: All post-validation survivors persist via `EnrollmentRepository.saveMany(...)` inside one `prisma.$transaction`.

**Eligible students**
- **FR-6**: `GET /classes/:classId/eligible-students` accepts standard pagination (`limit`, `offset`, `sort`) plus `search?` (ilike on `fullName`) and `includeStatuses?` (CSV; default `ACTIVE`).
- **FR-7**: Every returned student satisfies all of: `student.campusId === class.campusId`; `student.isArchived === false`; `student.status ∈ includeStatuses ∩ {ACTIVE, WAITING, TRIAL, DEFERRED}`; **no** row in `enrollment` with `studentId = student.id AND endDate IS NULL`.
- **FR-8**: Cross-campus class returns 404 (D5).

**Bulk transfer**
- **FR-9**: `POST /classes/:id/transfers/bulk` accepts `{ transferDate, note?, students: [{ studentId, fromClassId?, note? }] }` and returns `{ transferred: [{ closed: EnrollmentResponse, opened: EnrollmentResponse }], skipped: [{ studentId, reason, message? }] }`.
- **FR-10**: Whole-call validation, in order: (a) `BATCH_EMPTY`; (b) `BATCH_TOO_LARGE`; (c) `DUPLICATE_STUDENT_IN_BATCH`; (d) target class exists & in campus (else 404); (e) `transferDate` within target `class.schoolYear` range (else 400 `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`).
- **FR-11**: Per-row validation, in order: (a) `NO_ACTIVE_ENROLLMENT`; (b) `TRANSFER_SOURCE_MISMATCH` (only when `fromClassId` is provided); (c) `TRANSFER_SAME_CLASS`. First failure pushes to `skipped[]`.
- **FR-12**: Each survivor's transfer runs through the existing `enrollmentRepository.transferEnrollment(closed, opened)`, which is its own DB transaction. Partial-batch success is allowed and expected.

**Shared**
- **FR-13**: All three endpoints use `@RequireCampusAccess()` and read campus via `@CampusContext()`. Swagger decorators (`ApiOperation`, `ApiHeader`, `ApiParam`, `ApiQuery`, `StandardResponse`) match the existing class-management controller style.
- **FR-14**: Bulk endpoints emit Logger entries on entry, success-summary, and failure with `classId`, `campusId`, and counts.
- **FR-15**: New error-code constants module at `src/application/class-management/enrollment-error-codes.ts` exports the 6 codes listed in D4. The bulk use cases import from it; existing single-row use cases are not modified.

### Non-Functional Requirements

- **NFR-1**: Batch ceiling = 100 students per call. Class rosters typically max out around 30–40; the ceiling provides headroom while bounding the worst-case transaction size and pre-validation lookup count. Exceeding → 400 `BATCH_TOO_LARGE`.
- **NFR-2**: Bulk-enroll persistence step uses one transaction containing the create-many; pre-validation is allowed to issue its own queries (per-row lookups), but should prefer `findByIds` where it reduces round trips.
- **NFR-3**: The eligible-students endpoint MUST paginate; never return an unbounded list.
- **NFR-4**: All three endpoints have full Swagger documentation consistent with existing class-management endpoints.

## Acceptance Criteria

### Bulk enroll

- [ ] **AC-1**: `POST /classes/<id>/enrollments/bulk` with 5 valid students returns 200 with `enrolled.length === 5`, `skipped.length === 0`. DB has 5 new rows with `endDate IS NULL` and `enrollmentDate` set to the batch value.
- [ ] **AC-2**: Mixed batch — 3 valid + 1 already-enrolled + 1 cross-campus returns 200 with `enrolled.length === 3`, `skipped.length === 2` containing reasons `STUDENT_ALREADY_ENROLLED` and `STUDENT_NOT_IN_CAMPUS`. The 3 enrolled rows persist.
- [ ] **AC-3**: All-skipped batch (e.g., all 5 students already-enrolled) returns 200 with `enrolled.length === 0`, `skipped.length === 5`. No new rows written.
- [ ] **AC-4**: Whole-call: class doesn't exist → 404 `Class with ID … not found`. Cross-campus class → 404 (same body — existence hidden, per D5). No row work performed.
- [ ] **AC-5**: Whole-call: `enrollmentDate` outside `class.schoolYear` → 400 `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`. No row work.
- [ ] **AC-6**: Whole-call limits: 101 students → 400 `BATCH_TOO_LARGE`; 0 students → 400 `BATCH_EMPTY`; duplicate `studentId` in payload → 400 `DUPLICATE_STUDENT_IN_BATCH`.
- [ ] **AC-7**: Per-row note overrides batch note. With batch `note="Term 2 cohort"` and per-row `note="Late join"`, the persisted row has `note="Late join"`. Without per-row note, the row has `note="Term 2 cohort"`.
- [ ] **AC-8**: Race condition — if a unique-violation fires inside `saveMany`'s transaction (concurrent enroll occurred between validation and persistence), the entire batch rolls back. The endpoint returns 5xx (unhandled) and no rows persist. Documented behavior, not a happy path.

### Eligible students

- [ ] **AC-9**: `GET /classes/<classId>/eligible-students` returns paginated `StudentResponse`. Every returned student is at `class.campusId`, `isArchived=false`, `status ∈ {ACTIVE}` (default), and has no row in `enrollment` with `endDate IS NULL`.
- [ ] **AC-10**: With `?includeStatuses=ACTIVE,WAITING`, returned students additionally include WAITING-status rows. Passing `DROPPED` or `GRADUATED` in `includeStatuses` returns 400 (DTO rejects them at validation time).
- [ ] **AC-11**: With `?search=Anh`, results filter by ilike on `fullName`. Pagination (`limit`, `offset`) and sort behave per `StandardRequest` semantics.
- [ ] **AC-12**: Cross-campus class → 404 (D5).
- [ ] **AC-13**: A student currently active in any class is excluded from results, even if their `status === ACTIVE`.

### Bulk transfer

- [ ] **AC-14**: `POST /classes/<targetId>/transfers/bulk` with 4 students all currently active in another class returns 200 with `transferred.length === 4`, `skipped.length === 0`. Each `closed` row has `endDate=transferDate, exitReason="TRANSFERRED"`. Each `opened` row has `endDate IS NULL`.
- [ ] **AC-15**: Mixed batch — 2 with active enrollment + 1 without active + 1 already in target class returns 200 with `transferred.length === 2`, `skipped` containing reasons `NO_ACTIVE_ENROLLMENT` and `TRANSFER_SAME_CLASS`.
- [ ] **AC-16**: Per-row independent transactions — forcing a DB error mid-batch leaves committed rows persisted and only the failing row's transaction rolled back. The `enrollment` table never has partial close-without-open or open-without-close states.
- [ ] **AC-17**: Whole-call: target class missing or in a different campus → 404. `transferDate` outside target class's school year → 400 `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`. No row work.
- [ ] **AC-18**: Whole-call limits same as AC-6 (`BATCH_EMPTY`, `BATCH_TOO_LARGE`, `DUPLICATE_STUDENT_IN_BATCH`).

### Domain & shared

- [ ] **AC-19**: New module `src/application/class-management/enrollment-error-codes.ts` exists and exports each of the 6 new codes from D4. Bulk use cases import from it.
- [ ] **AC-20**: `EnrollmentRepository.saveMany(enrollments: Enrollment[]): Promise<Enrollment[]>` exists on the port. Prisma impl uses one `prisma.$transaction` with `enrollment.create` per row, returning persisted entities in input order.
- [ ] **AC-21**: `StudentRepository.findEligibleForClass(classId: string, params: StandardRequest, scope?: { campusId: string }): Promise<PaginatedResult<Student>>` exists on the port. Prisma impl applies the `NOT EXISTS` predicate while still using `PrismaQueryService.executeQuery` for pagination, sort, and search.

## Scenarios

### Scenario 1 — Wizard happy path: enroll 25 students into the start of a new term
**Given** Class `A1` is at campus `C1`, school year `SY-25-26` (`2025-09-01` to `2026-06-30`). 25 active campus-`C1` students with no current enrollment are selected by the operator.
**When** Operator submits `POST /classes/A1/enrollments/bulk { enrollmentDate: "2025-09-01", students: [{studentId: s1}, ..., {studentId: s25}] }`.
**Then** Response 200 `{ enrolled.length: 25, skipped.length: 0 }`. All 25 rows persisted with `enrollmentDate=2025-09-01, endDate=null`. One DB transaction wraps the 25 inserts.

### Scenario 2 — Mixed batch: some students already active elsewhere
**Given** Class `B1` at campus `C1`. Operator selects 5 students; 2 have unexpected active enrollments in other classes.
**When** Operator submits the bulk-enroll call.
**Then** Response 200 with `enrolled.length: 3` (the unblocked rows persist) and `skipped.length: 2` reason `STUDENT_ALREADY_ENROLLED`. No partial transaction state. Frontend can route the 2 skipped rows into the wizard's transfer step.

### Scenario 3 — Whole-call abort: enrollment date outside school year
**Given** Class `A1` school year `SY-25-26` ends `2026-06-30`. Operator submits `enrollmentDate: 2026-07-15`.
**When** The validator hits the date-bounds step.
**Then** 400 `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`. Zero rows touched. No `skipped[]` array — whole-call failure.

### Scenario 4 — Eligible-students with status opt-in
**Given** Campus `C1` has 200 students; 130 are currently active in some class; 50 are status `WAITING`; 20 are `DROPPED`.
**When** `GET /classes/A1/eligible-students?limit=20&offset=0`.
**Then** Default response: paginated list of `ACTIVE` campus-`C1` students with no active enrollment row. With `?includeStatuses=ACTIVE,WAITING`, the 50 WAITING students also appear (subject to the same campus + no-active-enrollment + not-archived rules). DROPPED students never appear regardless of caller request.

### Scenario 5 — Bulk transfer happy path: end-of-term cohort move
**Given** 12 students currently active in class `Y1-A` at campus `C1`. Class `Y2-A` is the next-grade class in the same campus, school year `SY-25-26`.
**When** `POST /classes/Y2-A/transfers/bulk { transferDate: "2026-06-30", students: [{studentId: s1}, ...] }` (12 students).
**Then** Response 200 `{ transferred.length: 12, skipped.length: 0 }`. Each row's `closed` has `exitReason="TRANSFERRED", endDate=2026-06-30`; `opened` has `enrollmentDate=2026-06-30, endDate=null`. 12 independent DB transactions; no batch-level transaction.

### Scenario 6 — Bulk transfer partial failure (per-row independence)
**Given** Bulk-transfer call mid-flight for 10 students. After 4 rows committed, an unexpected DB error fires for the 5th row's transaction.
**When** The 5th row's `transferEnrollment` rolls back.
**Then** The 4 committed rows persist. The 5th row appears in `skipped[]` with an error code; remaining rows continue processing. Critically: the `enrollment` table never holds a partial open-without-close or close-without-open state — atomicity is preserved per row.

### Scenario 7 — Wizard pre-validation surfaces invalids at submit time
**Given** Wizard's eligible-students panel listed 30 students; operator selected 30 to bulk-enroll. Between selection and submit, 1 of the 30 was enrolled by another user.
**When** Bulk-enroll runs validation.
**Then** Response 200 with `enrolled.length: 29, skipped.length: 1` reason `STUDENT_ALREADY_ENROLLED`. Operator sees the 1 skipped row in the wizard and decides whether to transfer them.

### Scenario 8 — Whole-call duplicate detection
**Given** Operator's payload contains `studentId: s1` twice (e.g., a UI bug or copy-paste error).
**When** Bulk-enroll runs validation.
**Then** 400 `DUPLICATE_STUDENT_IN_BATCH` before any per-row work or DB lookups. Body contains the offending studentId(s) for debugging.

## Technical Notes

### Use cases

- `src/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case.ts`
- `src/application/class-management/use-cases/enrollment/bulk-transfer-students.use-case.ts`
- `src/application/user-management/use-cases/student/get-eligible-students-for-class.use-case.ts` *(student-keyed query; lives in user-management)*

### Repository changes

`EnrollmentRepository` port (`src/application/class-management/ports/enrollment.repository.ts`):
- Add `saveMany(enrollments: Enrollment[]): Promise<Enrollment[]>`.

`PrismaEnrollmentRepository` (`src/infra/persistence/prisma/repositories/prisma-enrollment.repository.ts`):
- Implement `saveMany` inside `prisma.$transaction(async tx => …)`, looping `tx.enrollment.create` per row with the standard `include: { class: true, student: true }`. Return mapped domain entities in input order.

`StudentRepository` port (`src/application/user-management/ports/student.repository.ts`):
- Add `findEligibleForClass(classId: string, params: StandardRequest, scope?: { campusId: string }): Promise<PaginatedResult<Student>>`.

`PrismaStudentRepository`:
- Build the `NOT EXISTS` predicate (Prisma's `enrollments: { none: { endDate: null } }` shorthand works on the relation). Combine with `isArchived: false` and `status: { in: includeStatuses }` plus the standard `scope.campusId`. Route through `PrismaQueryService.executeQuery` so pagination, sort, and `search` (ilike on `fullName`) keep working through the existing infrastructure.

### HTTP wiring

- `class.controller.ts`: add `bulkEnroll` (`POST :id/enrollments/bulk`), `bulkTransfer` (`POST :id/transfers/bulk`), and `getEligibleStudents` (`GET :classId/eligible-students`). All three sit naturally under the class-scoped controller because their URLs are class-scoped.
- All three: `@RequireCampusAccess()`, `@CampusContext() campusId`, `@StandardResponse({ ... })`, full Swagger.

### DTOs (HTTP layer)

- `src/infra/http/dtos/class-management/bulk-enroll-students.request.ts` — `BulkEnrollStudentsRequest` + nested `BulkEnrollStudentItemDto` with `class-validator` (`@IsArray`, `@ValidateNested`, `@Type`, `@ArrayMinSize(1)`, `@ArrayMaxSize(100)`).
- `src/infra/http/dtos/class-management/bulk-enroll-students.response.ts` — `BulkEnrollStudentsResponse` + `BulkSkippedItemResponse` (mirrors `BulkRecordAttendanceResponse` shape).
- `src/infra/http/dtos/class-management/bulk-transfer-students.request.ts` / `.response.ts` — same pattern; response is `{ transferred: TransferStudentResponse[], skipped: BulkSkippedItemResponse[] }`.
- `src/infra/http/dtos/class-management/eligible-students.query.ts` — extends the `StandardRequestDto` shape with `search?: string` and `includeStatuses?: string` (CSV → `StudentStatus[]` via `@Transform`; rejects `DROPPED`, `GRADUATED`).

### Error codes module

```ts
// src/application/class-management/enrollment-error-codes.ts
export const EnrollmentErrorCode = {
  // Whole-call (HTTP 400)
  BATCH_TOO_LARGE: "BATCH_TOO_LARGE",
  BATCH_EMPTY: "BATCH_EMPTY",
  DUPLICATE_STUDENT_IN_BATCH: "DUPLICATE_STUDENT_IN_BATCH",
  // Per-row (skipped[].reason)
  STUDENT_NOT_FOUND: "STUDENT_NOT_FOUND",
  STUDENT_NOT_IN_CAMPUS: "STUDENT_NOT_IN_CAMPUS",
  ENROLLMENT_ALREADY_EXISTS_ON_DATE: "ENROLLMENT_ALREADY_EXISTS_ON_DATE",
} as const;
export type EnrollmentErrorCode =
  typeof EnrollmentErrorCode[keyof typeof EnrollmentErrorCode];
```

Existing inline codes (`STUDENT_ALREADY_ENROLLED`, `NO_ACTIVE_ENROLLMENT`, `TRANSFER_SAME_CLASS`, `TRANSFER_SOURCE_MISMATCH`, `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`) are reused as-is per D4 — no refactor of single-row use cases.

### Module wiring

`ClassManagementModule` already imports `UserManagementModule` (`class-management.module.ts:54, 68`) so `STUDENT_REPOSITORY` is available. New use cases drop into the existing providers list. The `GetEligibleStudentsForClass` use case lives in `user-management` (it's a student query) and is registered with `UserManagementModule`. The class controller injects it directly through the existing module wiring.

### Patterns to mirror (citations)

- Per-row tolerance: `src/application/attendance/use-cases/bulk-record-attendance.use-case.ts:60-171`.
- Bulk DTO with nested validation: `src/infra/http/dtos/attendance/bulk-record-attendance.request.ts:1-82`.
- Bulk response shape: `src/infra/http/dtos/attendance/student-attendance.response.ts:216-236`.
- Batched transactional persistence: `src/infra/persistence/prisma/repositories/prisma-student-attendance.repository.ts:300-340`.
- Atomic close+open: `src/infra/persistence/prisma/repositories/prisma-enrollment.repository.ts:174-193`.
- Single-row enroll validation chain: `src/application/class-management/use-cases/enrollment/enroll-student.use-case.ts:35-122`.
- Single-row transfer validation chain: `src/application/class-management/use-cases/enrollment/transfer-student.use-case.ts:40-112`.

### Out of scope (explicit)

- Bulk staff assignment endpoint.
- Frontend wizard implementation, hooks, services, UI.
- Centralizing the existing single-row error codes (D4 leaves them inline).
- Normalizing `EnrollStudentUseCase`'s 400 cross-campus-class behavior to 404 (D5 keeps it 400).
- "Unassigned student" filter that ignores school-year context.
- Idempotency keys (single-shot bulk submission only).
- Source-class school-year validation in bulk transfer (mirrors single-row `TransferStudentUseCase`, which only validates the target's school year — see Q2 below).

## Open Questions

- [ ] **Q1**: Should `findEligibleForClass` cap the maximum returned page size (e.g., `limit=200`) to bound query cost, or rely on the existing `StandardRequest.maxLimit=50` default? Plan phase decides.
- [ ] **Q2**: Bulk transfer per-row validation does NOT check the source-class's school year — it only validates `transferDate` against the target class's school year. This matches single-row `TransferStudentUseCase` behavior. Should the spec confirm this is intentional, or should bulk transfer be stricter than single-row?
- [ ] **Q3**: When `saveMany`'s batch transaction fails on an unexpected DB-level error (race condition unique-violation), should the response be 5xx (current FR-5 behavior — fail loud, surface real bug) or 200 with all rows in `skipped[]` carrying a generic `BATCH_PERSISTENCE_FAILED` code? Spec leans 5xx; plan phase can revisit.
- [ ] **Q4**: For `bulk-transfer`, should the response shape inline `closed`/`opened` per row (current FR-9 = `transferred: [{ closed, opened }]`) or flatten to a single `enrollments` array? Frontend spec leans toward keeping the pair so the wizard can display "moved from X to Y" cleanly.
