---
id: rp4om0
title: Bulk Transfer endpoint — use case, DTOs, controller
status: done
priority: medium
labels:
  - from-spec
  - backend
  - class-management
  - bulk-enrollment
  - feature
  - use-case
  - controller
createdAt: '2026-05-10T19:42:21.808Z'
updatedAt: '2026-05-10T23:07:09.051Z'
timeSpent: 4338
assignee: '@me'
spec: specs/bulk-enrollment
fulfills:
  - AC-14
  - AC-15
  - AC-16
  - AC-17
  - AC-18
---
# Bulk Transfer endpoint — use case, DTOs, controller

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement `POST /classes/:id/transfers/bulk` end-to-end per FR-9..FR-12. Whole-call validation (FR-10): BATCH_EMPTY → BATCH_TOO_LARGE → DUPLICATE_STUDENT_IN_BATCH → target class+in-campus (404 per D5) → transferDate within target schoolYear (400). Per-row validation (FR-11): NO_ACTIVE_ENROLLMENT → TRANSFER_SOURCE_MISMATCH (when fromClassId provided) → TRANSFER_SAME_CLASS. Each survivor calls existing `enrollmentRepository.transferEnrollment(closed, opened)` — per-row independent transactions (D7), partial-batch success allowed. Reuses existing inline single-row codes per D4; imports new whole-call codes from error-codes module. New DTOs (request + response with `{ transferred: [{ closed, opened }], skipped }`). Wire on `class.controller.ts`. Depends on the error-codes module task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 BulkTransferStudentsUseCase created with whole-call validation: BATCH_EMPTY → BATCH_TOO_LARGE → DUPLICATE_STUDENT_IN_BATCH → target class+campus (404) → target schoolYear bounds (400)
- [x] #2 Per-row validation: NO_ACTIVE_ENROLLMENT → TRANSFER_SOURCE_MISMATCH (only when fromClassId provided) → TRANSFER_SAME_CLASS
- [x] #3 Each survivor calls enrollmentRepository.transferEnrollment(closed, opened) — per-row independent transactions
- [x] #4 Partial-batch success allowed; one row's failure does not roll back others (D7)
- [x] #5 Cross-campus target class returns NotFoundException (D5)
- [x] #6 Imports new whole-call codes from `enrollment-error-codes.ts`
- [x] #7 Reuses inline single-row codes (NO_ACTIVE_ENROLLMENT, TRANSFER_SAME_CLASS, TRANSFER_SOURCE_MISMATCH) per D4
- [x] #8 BulkTransferStudentsRequest DTO with @ValidateNested, @ArrayMinSize(1), @ArrayMaxSize(100)
- [x] #9 BulkTransferStudentsResponse DTO with `transferred: [{ closed, opened }]` and `skipped` array
- [x] #10 Controller route `bulkTransfer` on class.controller.ts with @CampusContext, @RequireCampusAccess, @StandardResponse, full Swagger
- [x] #11 Use case registered in ClassManagementModule providers
- [x] #12 Use case spec test: happy path 4 transferred / mixed batch / per-row independence (forced fail on row 5 leaves rows 1-4 persisted)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — Bulk Transfer endpoint

Targets `POST /classes/:id/transfers/bulk` per FR-9..FR-12. Mirrors the bulk-enroll precedent (file shape, DTO shape, controller wiring), reuses the existing single-row transfer chain, and runs each survivor through `enrollmentRepository.transferEnrollment` so D7 partial-batch success drops out for free.

### 1. Use case — `BulkTransferStudentsUseCase`
File: `src/application/class-management/use-cases/enrollment/bulk-transfer-students.use-case.ts`

DI: `ENROLLMENT_REPOSITORY`, `CLASS_REPOSITORY` (no STUDENT_REPOSITORY — transfer chain matches single-row `TransferStudentUseCase` which never resolves the student directly).

Input shape:
`{ campusId, classId (target), transferDate, note?, students: [{ studentId, fromClassId?, note? }] }`

Whole-call validation (FR-10), short-circuiting in this exact order — mirrors `BulkEnrollStudentsUseCase` lines 70–97 and imports from `enrollment-error-codes`:
1. `students.length === 0` → `BadRequestException(BATCH_EMPTY)`
2. `students.length > 100` → `BadRequestException(BATCH_TOO_LARGE)`
3. Set-dedupe pass → `BadRequestException(DUPLICATE_STUDENT_IN_BATCH)`
4. `classRepository.findById(classId)` + cross-campus check → `NotFoundException("Class with ID … not found")` (D5)
5. `targetClass.schoolYear!.isWithinDateRange(transferDate)` → `BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR")` (inline per D4)

Per-row validation (FR-11), tolerant — first failure pushes to `skipped[]` and continues:
1. `findActiveByStudentId(studentId)` returns null → `NO_ACTIVE_ENROLLMENT`
2. If `fromClassId` provided and `≠ active.classId` → `TRANSFER_SOURCE_MISMATCH`
3. If `active.classId === target classId` → `TRANSFER_SAME_CLASS`

Survivor persistence (FR-12, D7) — each `(close + open)` runs through `enrollmentRepository.transferEnrollment` in its own DB transaction. Per-row `try/catch` around the repo call:
- `InvalidEndDateException` → `skipped[].reason = "INVALID_TRANSFER_DATE"`, `message = err.message`
- Unknown error → `skipped[].reason = "TRANSFER_FAILED"`, `message = err.message`. Critically, the loop continues so rows 1..4 commit even if row 5 fails (AC-16, Scenario 6).

Per-row note inherits the batch note when undefined; an explicit `note: ""` per-row overrides (mirrors bulk-enroll precedent line 146–147). Logger entry/exit with `classId`, `campusId`, counts (FR-14).

### 2. Request DTO — `BulkTransferStudentsRequest`
File: `src/infra/http/dtos/class-management/bulk-transfer-students.request.ts`

- `BulkTransferStudentItemRequest`: `studentId` (`@IsUUID` required), `fromClassId` (`@IsOptional @IsUUID`), `note` (`@IsOptional @IsString @MaxLength(500)`).
- `BulkTransferStudentsRequest`: `transferDate` (`@IsDateString` required), `note` (optional MaxLength 500), `students` (`@IsArray`, `@ArrayMinSize(1, { message: "BATCH_EMPTY" })`, `@ArrayMaxSize(100, { message: "BATCH_TOO_LARGE" })`, `@ValidateNested({ each: true })`, `@Type(() => BulkTransferStudentItemRequest)`).

Mirrors `BulkEnrollStudentsRequest` exactly — same validators, Swagger decorators, error messages.

### 3. Response DTO — `BulkTransferStudentsResponse`
File: `src/infra/http/dtos/class-management/bulk-transfer-students.response.ts`

- `BulkTransferSkippedItemResponse`: `studentId`, `reason`, optional `message` (mirrors `BulkEnrollSkippedItemResponse`).
- `BulkTransferStudentsResponse`: `transferred: TransferStudentResponse[]` (reuses the existing `{ closed, opened }` shape — no need to create a new pair type) + `skipped: BulkTransferSkippedItemResponse[]`.

### 4. Barrel — `index.ts`
Append `export * from "./bulk-transfer-students.request"` and `./bulk-transfer-students.response`.

### 5. Controller route — `class.controller.ts`
Insert `bulkTransferStudents` route between the existing `bulkEnrollStudents` (line ~277) and `withdrawStudent` (line ~321):

- Path: `@Post(":id/transfers/bulk")`
- Decorators: `@RequireCampusAccess()`, `@StandardResponse({ message: "Bulk transfer completed", type: BulkTransferStudentsResponse })`, `@ApiOperation`, `@ApiHeader(CAMPUS_ID_HEADER)`, `@ApiParam(id)`.
- Handler signature: `bulkTransferStudents(@CampusContext() campusId, @Param("id") classId, @Body() dto: BulkTransferStudentsRequest)` → maps DTO → use case input → returns result.
- Constructor adds `BulkTransferStudentsUseCase` injection.

### 6. Module wiring
Add `BulkTransferStudentsUseCase` to `class-management.module.ts` providers list (`UserManagementModule` already imported; no new module imports required).

### 7. Use case spec — `bulk-transfer-students.use-case.spec.ts`
File: `src/application/class-management/use-cases/enrollment/bulk-transfer-students.use-case.spec.ts`. Mock builders inlined (matches `bulk-enroll-students.use-case.spec.ts` pattern — no shared mock factory entry needed). Coverage:

- **Whole-call** (5 tests): empty/too-large/duplicate → BadRequestException with correct code; class missing → NotFoundException; cross-campus class → same 404 body (D5); transferDate outside SY → BadRequestException `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`. Each must assert `transferEnrollment` was **not** called.
- **Per-row validation** (3 tests): NO_ACTIVE_ENROLLMENT pushes to skipped; TRANSFER_SOURCE_MISMATCH only fires when `fromClassId` provided and mismatches active.classId (no fromClassId → does not fire); TRANSFER_SAME_CLASS pushes to skipped.
- **AC-14 happy path**: 4 students all active elsewhere → `transferred.length=4`, `skipped.length=0`, `transferEnrollment` called 4 times, each call's `closed` has `endDate=transferDate` + `exitReason=TRANSFERRED`, each `opened` has `endDate=null`.
- **AC-15 mixed batch**: 4 students — 2 active elsewhere + 1 with no active + 1 already in target → `transferred.length=2`, `skipped` contains reasons `NO_ACTIVE_ENROLLMENT` and `TRANSFER_SAME_CLASS`.
- **AC-16 per-row independence** (the signature scenario): 5 rows, force `transferEnrollment.mockRejectedValueOnce` on the 5th call → rows 1–4 returned in `transferred[]` (already-persisted from the prior 4 successful calls), row 5 in `skipped[]` with reason `TRANSFER_FAILED`, loop continued past the failure. Verifies no `try/catch` swallow silences the rest of the batch.
- **Note inheritance** (1 test): per-row `note: undefined` inherits the batch-level note in the `opened` payload sent to `transferEnrollment`.

Expected ~12 tests across 3 describe blocks. Mirrors the structure of `bulk-enroll-students.use-case.spec.ts`.

### 8. Verification
- `npm run build` clean.
- `npx jest bulk-transfer-students` → all new tests pass.
- Regression sweep on prior bulk-enrollment surface: `npx jest bulk-enroll-students enrollment.repository transfer-student` to catch unintended drift.
- `mcp_knowns_validate({ entity: "rp4om0" })` clean.

### Notes / assumptions
- **Reason code for repo-level failures** (Scenario 6) — spec says "an error code" but doesn't name one. Choosing `TRANSFER_FAILED` for unknown errors and `INVALID_TRANSFER_DATE` for the domain `InvalidEndDateException`. Both are inline literals (D4 keeps single-row codes inline; these are also single-row, just discovered during persistence).
- **No new shared mock factory entry** — current `test-utils/mock-repository-factory.ts` has no `createMockEnrollmentRepository`. Following the bulk-enroll spec precedent and inlining for now; out of scope to refactor.
- **Skip in `BulkTransferSkippedItemResponse` vs reusing `BulkEnrollSkippedItemResponse`** — keeping a transfer-specific response type for swagger clarity; same shape, intentional duplication for separation of concerns.

### AC coverage check
- AC1 (use case + whole-call order) → Step 1
- AC2 (per-row order) → Step 1
- AC3 (each survivor calls transferEnrollment) → Step 1, verified in Step 7 happy path
- AC4 (partial-batch success / per-row independence) → Step 1 try/catch + Step 7 AC-16 test
- AC5 (cross-campus 404) → Step 1, verified in Step 7
- AC6 (imports new whole-call codes) → Step 1
- AC7 (reuses inline single-row codes per D4) → Step 1
- AC8 (request DTO with @ValidateNested, @ArrayMinSize(1), @ArrayMaxSize(100)) → Step 2
- AC9 (response DTO `transferred: [{ closed, opened }]` + `skipped`) → Step 3
- AC10 (controller route with all decorators) → Step 5
- AC11 (registered in ClassManagementModule providers) → Step 6
- AC12 (use case spec test: happy path / mixed batch / per-row independence) → Step 7
- Spec ACs (fulfills) AC-14..AC-18 — all covered by Steps 1 + 7.

All 12 task ACs + all 5 spec ACs map to plan steps. Largest step (Step 1: use case file) is ~120 LoC, completable in one pass. Total of 8 file touches (4 new, 4 modified — counting the controller, module, barrel, and use case spec as the new files plus 3 modifications) sits at the upper bound but acceptable for a leaf delivery.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation summary

Shipped `POST /classes/:id/transfers/bulk` end-to-end across 4 new files + 3 modified files.

### New files
- `src/application/class-management/use-cases/enrollment/bulk-transfer-students.use-case.ts` — use case orchestrating whole-call validation (FR-10: BATCH_EMPTY → BATCH_TOO_LARGE → DUPLICATE_STUDENT_IN_BATCH → target class+campus → transferDate within target SY) followed by per-row validation (FR-11: NO_ACTIVE_ENROLLMENT → TRANSFER_SOURCE_MISMATCH → TRANSFER_SAME_CLASS). Each survivor's close+open pair runs through `enrollmentRepository.transferEnrollment` inside its own DB transaction. Per-row try/catch on the repo call captures row-level failures into `skipped[].reason=TRANSFER_FAILED` (or `INVALID_TRANSFER_DATE` for caught `InvalidEndDateException`) — the loop continues so prior committed rows stay persisted (D7 / AC-16).
- `src/infra/http/dtos/class-management/bulk-transfer-students.request.ts` — `BulkTransferStudentsRequest` + nested `BulkTransferStudentItemRequest`. Class-validator chain: `@ArrayMinSize(1, { message: "BATCH_EMPTY" })`, `@ArrayMaxSize(100, { message: "BATCH_TOO_LARGE" })`, `@ValidateNested({ each: true })`, `@Type`. Item: `studentId` UUID required, optional `fromClassId` UUID, optional `note` MaxLength(500).
- `src/infra/http/dtos/class-management/bulk-transfer-students.response.ts` — reuses `TransferStudentResponse` for the `{ closed, opened }` pair; new `BulkTransferSkippedItemResponse` (separate from `BulkEnrollSkippedItemResponse` for Swagger clarity).
- `src/application/class-management/use-cases/enrollment/bulk-transfer-students.use-case.spec.ts` — 14 tests across 3 describe blocks (whole-call × 6, per-row × 4, end-to-end × 4 covering AC-14 happy / AC-15 mixed / AC-16 per-row independence with forced row-5 failure / note inheritance).

### Modified files
- `src/infra/http/dtos/class-management/index.ts` — added two barrel exports.
- `src/infra/http/controllers/class-management/class.controller.ts` — added DTO imports, `BulkTransferStudentsUseCase` import, constructor injection, and the `bulkTransferStudents` route handler at `@Post(":id/transfers/bulk")` with full Swagger (`@ApiOperation`, `@ApiHeader(CAMPUS_ID_HEADER)`, `@ApiParam(id)`) and `@RequireCampusAccess()` + `@StandardResponse({ message, type: BulkTransferStudentsResponse })`.
- `src/infra/http/modules/class-management.module.ts` — added `BulkTransferStudentsUseCase` import + provider entry.

### Notable judgment calls
- Row-level repo failure surfaced as `TRANSFER_FAILED` (with the caught error's `message` copied into `skipped[].message`) — stable machine code mirroring the pattern from D9; inline per D4. Caught `InvalidEndDateException` separately as `INVALID_TRANSFER_DATE` so domain-invariant violations are distinguishable from generic DB failures.
- Mocks inlined in the spec (same pattern as `bulk-enroll-students.use-case.spec.ts`) — kept `test-utils/mock-repository-factory.ts` untouched since adding `createMockEnrollmentRepository` is out of scope for this task.
- During test runs the AC-14/15/16 batches initially failed because the original `transferDate=2026-06-30` was in the future relative to today (2026-05-10), and `Enrollment.withdraw` enforces `endDate <= today`. Adjusted to `2026-03-15` (after the active enrollment's enrollmentDate of 2025-09-01 and before today). Documented the constraint in a comment so future test edits don't trip on it.

### Verification
- `npm run build` → 0 errors.
- `npx jest bulk-transfer-students` → 14/14 pass.
- Regression sweep `bulk-enroll-students enrollment.repository transfer-student get-eligible-students-for-class eligible-students.query` → 6 suites / 74 tests pass.
- `mcp_knowns_validate({ entity: "rp4om0" })` → 0 errors / 0 warnings.

### SOLID + Clean Architecture compliance
- **SRP**: use case orchestrates two phases (whole-call validation and per-row tolerant persistence) without any persistence/HTTP concerns leaking in.
- **DIP**: depends on `ENROLLMENT_REPOSITORY` and `CLASS_REPOSITORY` ports via `@Inject` tokens; no Prisma types referenced in application layer.
- **OCP**: extending future whole-call or per-row checks is a localized append; existing validation order is preserved by spec contract.
- **ISP**: `transferEnrollment(closed, opened)` is a narrow repo method already shared with the single-row `TransferStudentUseCase` — no new port surface added.
- **Clean Architecture**: domain invariants (`Enrollment.withdraw`, `ExitReason.TRANSFERRED`, `Enrollment.create`) drive the close+open construction; HTTP layer carries no business logic; new module wiring stays in the infra/http module.

Fulfills spec ACs AC-14..AC-18 (auto-checked on `done`).
<!-- SECTION:NOTES:END -->

