---
id: zl7xnd
title: Bulk Enroll endpoint — use case, DTOs, controller
status: done
priority: high
labels:
  - from-spec
  - backend
  - class-management
  - bulk-enrollment
  - feature
  - use-case
  - controller
createdAt: '2026-05-10T19:42:12.053Z'
updatedAt: '2026-05-10T21:14:31.553Z'
timeSpent: 591
assignee: '@me'
spec: specs/bulk-enrollment
fulfills:
  - AC-1
  - AC-2
  - AC-3
  - AC-4
  - AC-5
  - AC-6
  - AC-7
  - AC-8
---
# Bulk Enroll endpoint — use case, DTOs, controller

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement `POST /classes/:id/enrollments/bulk` end-to-end per FR-1..FR-5. Mirrors `bulk-record-attendance.use-case.ts` per-row tolerant pattern. Whole-call validation order (FR-3): BATCH_EMPTY → BATCH_TOO_LARGE → DUPLICATE_STUDENT_IN_BATCH → class exists+in-campus (404 per D5) → enrollmentDate within schoolYear (400). Per-row validation (FR-4): STUDENT_NOT_FOUND → STUDENT_NOT_IN_CAMPUS → STUDENT_ALREADY_ENROLLED → ENROLLMENT_ALREADY_EXISTS_ON_DATE. Per-row note overrides batch-level note (FR-2). Survivors persist via `enrollmentRepository.saveMany` in one transaction (FR-5). New DTOs mirror `BulkRecordAttendanceRequest`/`Response`. Wire on `class.controller.ts`. Depends on the error-codes module and saveMany port tasks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 BulkEnrollStudentsUseCase created with whole-call validation in order: BATCH_EMPTY → BATCH_TOO_LARGE → DUPLICATE_STUDENT_IN_BATCH → class+campus (404) → schoolYear bounds (400)
- [x] #2 Per-row validation in order: STUDENT_NOT_FOUND → STUDENT_NOT_IN_CAMPUS → STUDENT_ALREADY_ENROLLED → ENROLLMENT_ALREADY_EXISTS_ON_DATE
- [x] #3 Per-row note overrides batch note; omitted per-row inherits batch note
- [x] #4 Cross-campus class returns NotFoundException (D5)
- [x] #5 Imports codes from `enrollment-error-codes.ts`
- [x] #6 Persists survivors via `enrollmentRepository.saveMany`
- [x] #7 BulkEnrollStudentsRequest DTO with @ValidateNested, @Type, @ArrayMinSize(1), @ArrayMaxSize(100)
- [x] #8 BulkEnrollStudentsResponse DTO mirrors BulkRecordAttendanceResponse shape
- [x] #9 Controller route `bulkEnroll` on class.controller.ts with @CampusContext, @RequireCampusAccess, @StandardResponse, full Swagger
- [x] #10 Use case registered in ClassManagementModule providers
- [x] #11 Use case spec test: happy path / mixed batch / all-skipped / each whole-call abort / per-row note override
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — Bulk Enroll endpoint

### Step 1 — `BulkEnrollStudentsUseCase` (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6)
File: `src/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case.ts`

Mirrors `bulk-record-attendance.use-case.ts:60-171` per-row tolerant pattern, with enrollment-specific validation chain.

```ts
@Injectable()
export class BulkEnrollStudentsUseCase {
  private readonly logger = new Logger(BulkEnrollStudentsUseCase.name);
  constructor(
    @Inject("ENROLLMENT_REPOSITORY") private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY") private readonly classRepository: ClassRepository,
    @Inject("STUDENT_REPOSITORY") private readonly studentRepository: StudentRepository,
  ) {}

  async execute(input: BulkEnrollStudentsInput): Promise<BulkEnrollStudentsResult> {
    // Whole-call validation (FR-3) — short-circuits in this exact order:
    // 1. BATCH_EMPTY (length === 0)
    // 2. BATCH_TOO_LARGE (length > 100)
    // 3. DUPLICATE_STUDENT_IN_BATCH (Set-based dedup pass)
    // 4. Class existence + cross-campus → NotFoundException (D5: hide existence)
    // 5. enrollmentDate within class.schoolYear bounds → BadRequest "ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR" (D4 inline code)

    // Per-row validation (FR-4) — first failure pushes to skipped[] and continues:
    // 1. STUDENT_NOT_FOUND
    // 2. STUDENT_NOT_IN_CAMPUS
    // 3. STUDENT_ALREADY_ENROLLED (inline string per D4 — existing single-row code)
    // 4. ENROLLMENT_ALREADY_EXISTS_ON_DATE (defensive composite-key check)

    // Per-row note overrides batch note (FR-2):
    //   row.note !== undefined ? row.note : (input.note ?? null)
    //   — using `!== undefined` so an explicit empty string per-row still overrides

    // Survivors persist via enrollmentRepository.saveMany (FR-5; built in 5sey28)
  }
}
```

Imports `EnrollmentErrorCode` from `../../enrollment-error-codes` (built in h8t9p8) for the bulk-only codes used in this use case (BATCH_EMPTY, BATCH_TOO_LARGE, DUPLICATE_STUDENT_IN_BATCH, STUDENT_NOT_FOUND, STUDENT_NOT_IN_CAMPUS, ENROLLMENT_ALREADY_EXISTS_ON_DATE). `STUDENT_ALREADY_ENROLLED` stays inline per D4. `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR` also stays inline per D4 (existing single-row code reused for the whole-call check).

### Step 2 — Barrel export (use case)
File: `src/application/class-management/use-cases/enrollment/index.ts` — add `export * from "./bulk-enroll-students.use-case";`

### Step 3 — Request DTO (AC-7)
File: `src/infra/http/dtos/class-management/bulk-enroll-students.request.ts`

Two classes mirroring `BulkRecordAttendanceRequest`:
- `BulkEnrollStudentItem` — `@IsUUID studentId`, `@IsOptional @IsString @MaxLength(500) note?`
- `BulkEnrollStudentsRequest` — `@IsDateString enrollmentDate`, `@IsOptional note?`, `@IsArray @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => BulkEnrollStudentItem) students[]`

DTO-level `@ArrayMinSize(1)` and `@ArrayMaxSize(100)` will fire 400 before the use case sees the payload — use case still has matching guards as defense-in-depth.

### Step 4 — Response DTO (AC-8)
File: `src/infra/http/dtos/class-management/bulk-enroll-students.response.ts`

Mirrors `BulkRecordAttendanceResponse` shape (`student-attendance.response.ts:216-236`):
- `BulkEnrollSkippedItem` — `studentId`, `reason: string`, `message?: string`
- `BulkEnrollStudentsResponse` — `@Type(() => EnrollmentResponse) enrolled: EnrollmentResponse[]` and `@Type(() => BulkEnrollSkippedItem) skipped: BulkEnrollSkippedItem[]`

### Step 5 — Barrel export (DTOs)
File: `src/infra/http/dtos/class-management/index.ts` — add the two new exports.

### Step 6 — Controller route (AC-9)
File: `src/infra/http/controllers/class-management/class.controller.ts`
- Inject `BulkEnrollStudentsUseCase` in constructor.
- Add `@Post(":id/enrollments/bulk")` between the existing `enrollStudent` (`POST :id/enrollments`) and `withdrawStudent` routes.
- Decorators: `@RequireCampusAccess()`, `@StandardResponse({ message: "Bulk enroll completed", type: BulkEnrollStudentsResponse })`, `@ApiOperation`, `@ApiHeader(CAMPUS_ID_HEADER)`, `@ApiParam("id")`.
- Body parses `enrollmentDate` via `new Date(dto.enrollmentDate)` (matches `enrollStudent` precedent).

### Step 7 — Module registration (AC-10)
File: `src/infra/http/modules/class-management.module.ts` — add `BulkEnrollStudentsUseCase` to the Enrollment Use Cases section + providers list (mirrors how `EnrollStudentUseCase` is registered).

### Step 8 — Use-case spec test (AC-11)
File: `src/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case.spec.ts`

Mirrors `enroll-student.use-case.spec.ts` mock setup (`jest.Mocked<EnrollmentRepository | ClassRepository | StudentRepository>` triple). Test cases:
- **Happy path** — 5 valid students → `enrolled.length === 5`, `skipped.length === 0`, `saveMany` called once with 5 entities (covers AC-1)
- **Mixed batch** — 3 valid + 1 already-enrolled + 1 cross-campus → `enrolled.length === 3`, `skipped.length === 2` with codes `STUDENT_ALREADY_ENROLLED` and `STUDENT_NOT_IN_CAMPUS` (covers AC-2)
- **All skipped** — all 5 already-enrolled → `saveMany` NEVER called, `enrolled.length === 0`, `skipped.length === 5` (covers AC-3)
- **Whole-call: missing class** → throws `NotFoundException` (covers AC-4 part 1)
- **Whole-call: cross-campus class** → throws `NotFoundException` (D5 — same message as missing, covers AC-4 part 2)
- **Whole-call: enrollmentDate outside schoolYear** → throws `BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR")` (covers AC-5)
- **Whole-call: empty array** → throws `BadRequestException("BATCH_EMPTY")` (covers AC-6 part 1)
- **Whole-call: 101 rows** → throws `BadRequestException("BATCH_TOO_LARGE")` (covers AC-6 part 2)
- **Whole-call: duplicate studentIds** → throws `BadRequestException("DUPLICATE_STUDENT_IN_BATCH")` (covers AC-6 part 3)
- **Per-row note override** — batch note "Term 2"; one row has note "Late join", one has no note → entities passed to `saveMany` have notes `"Late join"` and `"Term 2"` respectively (covers AC-7)
- **AC-8 (race condition rollback)** — implicit: `saveMany` is the atomic boundary (proven in 5sey28's tests); a unique-violation propagating out of `saveMany` flows through unchanged. Light assertion: `saveMany` rejection bubbles up (no try/catch swallow).

### Step 9 — Verify
- `npm run build` → 0 errors
- `npx jest src/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case.spec.ts` → all green
- `npx jest src/application/class-management/use-cases/enrollment` → no regression on existing enrollment suites

---

### Pre-execution plan check
- **AC coverage**: AC-1/2/3/4/5/6 → S1; AC-7 → S3; AC-8 → S4; AC-9 → S6; AC-10 → S7; AC-11 → S8. ✅ all 11 covered.
- **Scope**: 6 new/modified source files + 1 new test file + 2 barrel updates = 9 file touches. Sizable but cohesive — typical for a feature task. ⚠️ at the edge of single-session, but acceptable since each step is independent.
- **Dependencies**: foundations (h8t9p8 error codes ✓, 5sey28 saveMany ✓) both done. Patterns (`bulk-record-attendance.use-case`, `enroll-student.use-case`, `transferEnrollment` 404 convention) all in place.
- **Risk**: low. Adds one new route to a shared controller (additive, not modifying existing routes). Tests cover every AC explicitly.

### Refs
- @doc/specs/bulk-enrollment — FR-1..FR-5, AC-1..AC-8, D4, D5, D9, D10
- @task-h8t9p8 (done) — error codes module
- @task-5sey28 (done) — `saveMany` port + Prisma impl
- Pattern: `src/application/attendance/use-cases/bulk-record-attendance.use-case.ts:60-171`
- Pattern: `src/application/class-management/use-cases/enrollment/enroll-student.use-case.ts:35-122`
- Pattern: `src/infra/http/dtos/attendance/bulk-record-attendance.request.ts:1-82`
- Pattern: `src/infra/http/dtos/attendance/student-attendance.response.ts:216-236`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete. Bulk Enroll endpoint shipped end-to-end.

**Files changed (5 new + 4 modified):**
- NEW `src/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case.ts` — use case with whole-call validation chain (BATCH_EMPTY → BATCH_TOO_LARGE → DUPLICATE_STUDENT_IN_BATCH → class+campus 404 per D5 → schoolYear bounds 400) and tolerant per-row validation (STUDENT_NOT_FOUND → STUDENT_NOT_IN_CAMPUS → STUDENT_ALREADY_ENROLLED inline → ENROLLMENT_ALREADY_EXISTS_ON_DATE). Per-row note overrides batch note via `row.note !== undefined ? row.note : (input.note ?? null)`. Survivors persist via `enrollmentRepository.saveMany` (foundation from 5sey28). MAX_BATCH_SIZE=100 hoisted as named constant.
- NEW `bulk-enroll-students.use-case.spec.ts` — 14 tests across 4 describe blocks (whole-call validation, per-row validation+persistence, note resolution, race-condition rollback) covering every AC explicitly.
- NEW `src/infra/http/dtos/class-management/bulk-enroll-students.request.ts` — `BulkEnrollStudentItemRequest` + `BulkEnrollStudentsRequest` with @ValidateNested + @Type + @ArrayMinSize(1, "BATCH_EMPTY") + @ArrayMaxSize(100, "BATCH_TOO_LARGE"). DTO-level validation fires 400 before use case sees payload; use-case-level checks remain as defense-in-depth.
- NEW `bulk-enroll-students.response.ts` — mirrors `BulkRecordAttendanceResponse` shape with `BulkEnrollSkippedItemResponse` (studentId, reason, optional message) + `BulkEnrollStudentsResponse` (enrolled: EnrollmentResponse[], skipped: BulkEnrollSkippedItemResponse[]).
- MODIFIED enrollment use-case barrel — added bulk-enroll export.
- MODIFIED class-management DTO barrel — added request + response exports.
- MODIFIED `class.controller.ts` — `BulkEnrollStudentsUseCase` injected; `POST :id/enrollments/bulk` route wired with `@RequireCampusAccess`, `@StandardResponse({ message: "Bulk enroll completed", type: BulkEnrollStudentsResponse })`, full Swagger `@ApiOperation`/`@ApiHeader`/`@ApiParam`. Body's `enrollmentDate` parsed via `new Date(...)` matching the single-row enroll precedent.
- MODIFIED `class-management.module.ts` — `BulkEnrollStudentsUseCase` added to imports and providers.

**Verification:**
- `npm run build` (nest build) → 0 errors.
- `npx jest <bulk-enroll-students.use-case.spec.ts>` → 14/14 pass.
- `npx jest src/.../enrollment src/.../cross-campus-prevention.integration.spec.ts` → 7 suites / 69 tests pass (full enrollment + cross-campus suite, no regression).

**SOLID + Clean Architecture compliance:**
- SRP: use case has one responsibility (bulk-enroll orchestration); validation order is linear and named explicitly.
- DIP: use case depends on three abstract repository ports (constructor injection via NestJS @Inject tokens); zero infra coupling.
- OCP: error codes injected from `enrollment-error-codes.ts` (h8t9p8) so adding bulk-only codes does not require touching this use case.
- LSP: relies only on the contract documented on `EnrollmentRepository.saveMany` (input order, all-or-nothing). The Prisma impl's transaction is opaque from the use case's perspective.
- Layer placement: use case (application), DTOs (infra/http), controller (infra/http), error codes (application). Domain entities (`Enrollment.create`) used only at the persistence boundary, not for transport.
- D4 honored: existing single-row codes (`STUDENT_ALREADY_ENROLLED`, `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`) stay inline as string literals; only the 6 new bulk-only codes import from the centralized module.
- D5 honored: cross-campus class returns `NotFoundException` with the same body as missing class (existence hidden).
- D9 honored: per-row tolerant pattern; whole-call abort short-circuits with 4xx and zero row work.
- D10 honored: BATCH_EMPTY/BATCH_TOO_LARGE/DUPLICATE_STUDENT_IN_BATCH all surface before any DB lookup.

**Spec progress:** 3 of 6 tasks done. Remaining: o99c77 (StudentRepository.findEligibleForClass — last wave-1 foundation), 500uai (Eligible Students endpoint, blocked on o99c77), rp4om0 (Bulk Transfer endpoint, unblocked).
<!-- SECTION:NOTES:END -->

