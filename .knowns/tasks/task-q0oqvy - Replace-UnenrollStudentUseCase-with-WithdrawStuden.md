---
id: q0oqvy
title: Replace UnenrollStudentUseCase with WithdrawStudentUseCase + HTTP route
status: done
priority: high
labels:
  - from-spec
  - use-case
  - http
createdAt: '2026-05-05T23:33:10.384Z'
updatedAt: '2026-05-06T03:16:38.484Z'
timeSpent: 1557
assignee: '@me'
spec: specs/class-enrollment-period-model
fulfills:
  - AC-9
  - AC-10
  - AC-11
  - AC-12
  - AC-13
---
# Replace UnenrollStudentUseCase with WithdrawStudentUseCase + HTTP route

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delete `UnenrollStudentUseCase` in `src/application/class-management/use-cases/enrollment/` and remove `DELETE /classes/:classId/enrollments/:enrollmentId` from `class.controller.ts`. Add `WithdrawStudentUseCase` taking `(enrollmentId, campusId, endDate?, reason)` with default `endDate = today`. Add `POST /classes/:classId/enrollments/:enrollmentId/withdraw` accepting body `{ reason: ExitReason; endDate?: ISODate; note?: string }`. Wire into `class-management.module.ts`. Map domain errors to HTTP per the spec's error table (409 ENROLLMENT_ALREADY_CLOSED, 400 INVALID_END_DATE, 404 not-found / cross-campus).

Spec: @doc/specs/class-enrollment-period-model
Covers: FR-7, FR-12, NFR-3, NFR-5, NFR-6
Blocked by: Task 3 (repository + DTO)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `UnenrollStudentUseCase` and `DELETE /classes/:classId/enrollments/:enrollmentId` removed
- [x] #2 `WithdrawStudentUseCase` accepts `(enrollmentId, campusId, endDate?, reason)` with default `endDate = today`
- [x] #3 `POST /classes/:classId/enrollments/:enrollmentId/withdraw` accepts validated DTO `{ reason: ExitReason; endDate?: ISODate; note?: string }`
- [x] #4 Returns `EnrollmentResponse` populated with `endDate` and `exitReason`
- [x] #5 Domain errors mapped: 409 ENROLLMENT_ALREADY_CLOSED, 400 INVALID_END_DATE, 404 ENROLLMENT_NOT_FOUND / cross-campus
- [x] #6 Wired into `class-management.module.ts`; old use-case provider removed
- [x] #7 Use-case unit tests + controller integration tests cover AC-9, AC-10, AC-11, AC-12, AC-13
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

**Context:** AC #1 (UnenrollStudentUseCase + DELETE route removed) is **pre-satisfied** by jvdbpl. Domain entity Enrollment.withdraw(endDate, reason) and exceptions EnrollmentAlreadyClosedException / InvalidEndDateException already exist (q9gt2v). Repository port has findById and update. EnrollmentResponse already carries endDate + exitReason (jvdbpl).

Spec ref: @doc/specs/class-enrollment-period-model (FR-7, FR-12, NFR-3/5/6; ACs 9-13)

### Steps

1. **Auto-check AC #1** — grep-verify UnenrollStudentUseCase file + DELETE route are gone, then check AC #1 immediately. No new work.

2. **Create `WithdrawStudentRequest` DTO** at `src/infra/http/dtos/class-management/withdraw-student.request.ts`:
   - `reason: ExitReason` — `@IsEnum(ExitReason)` + `@IsNotEmpty()`
   - `endDate?: string` — `@IsOptional()` + `@IsDateString()`
   - `note?: string` — `@IsOptional()` + `@MaxLength(500)`
   - `@ApiProperty` decorators with examples; add to `dtos/class-management/index.ts` barrel.

3. **Create `WithdrawStudentUseCase`** at `src/application/class-management/use-cases/enrollment/withdraw-student.use-case.ts`. Constructor injects `EnrollmentRepository` via `@Inject("ENROLLMENT_REPOSITORY")`. Method: `execute({ enrollmentId, campusId, endDate?, reason, note? })`.
   - `findById(enrollmentId)` → null → `NotFoundException("Enrollment with ID ... not found")`
   - cross-campus: `enrollment.class!.campusId !== campusId` → `NotFoundException` (AC-13: 404, hide existence)
   - if `note` provided → `enrollment.update({ note })` first
   - call `enrollment.withdraw(endDate ?? new Date(), reason)` wrapped in try/catch:
     - `EnrollmentAlreadyClosedException` → `ConflictException("ENROLLMENT_ALREADY_CLOSED")`
     - `InvalidEndDateException` → `BadRequestException("INVALID_END_DATE: <msg>")`
   - persist via `enrollmentRepository.update(closed)` and return.
   - Add to `application/class-management/use-cases/enrollment/index.ts` barrel.

4. **Add HTTP route** to `src/infra/http/controllers/class-management/class.controller.ts`:
   - `@Post(":id/enrollments/:enrollmentId/withdraw")`
   - `@RequireCampusAccess()`, `@StandardResponse({ message, type: EnrollmentResponse })`
   - `@ApiOperation`, `@ApiHeader(CAMPUS_ID_HEADER)`, `@ApiParam` for both ids
   - Inject `WithdrawStudentUseCase` in constructor; route handler converts `dto.endDate` to `Date` if present and passes through.

5. **Wire provider** in `src/infra/http/modules/class-management.module.ts`: import `WithdrawStudentUseCase` and add to providers (UnenrollStudentUseCase already removed).

6. **Use-case unit tests** at `src/application/class-management/use-cases/enrollment/withdraw-student.use-case.spec.ts`. Mock `EnrollmentRepository` (full typed mock matching new port). Cases:
   - AC-9: default-today path → endDate set, exitReason set, repo.update called with closed entity
   - AC-10: second withdraw → `ConflictException` w/ "ENROLLMENT_ALREADY_CLOSED"
   - AC-11: explicit endDate honored on returned entity
   - AC-12a: endDate before enrollmentDate → `BadRequestException` w/ "INVALID_END_DATE"
   - AC-12b: endDate in future → `BadRequestException` w/ "INVALID_END_DATE"
   - AC-13: enrollment.class.campusId mismatch → `NotFoundException`
   - Negative: enrollment not found → `NotFoundException`
   - Optional note: passing note triggers `enrollment.update({note})` before withdraw.

7. **Validate**:
   - `npx tsc --noEmit` clean
   - `npx jest .../withdraw-student.use-case.spec.ts` → all green
   - `npx jest src/application/class-management src/domain/class-management src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts` → no regressions
   - `mcp_knowns_validate({ entity: "q0oqvy" })` → 0 errors
   - Append notes, check remaining ACs, stop timer, mark done; run SDD workflow.

### Scope sizing
6 files touched (2 new, 4 modified) — fits one session.

### Plan-quality note
AC #7 mentions "controller integration tests". The project has **no controller-test or e2e harness** (`Glob` for `controllers/**/*.spec.ts` and `test/**/*.e2e-spec.ts` both return zero). The use-case unit tests cover the domain→HTTP mapping (where the actual NestJS exception types are thrown, which the controller layer just propagates). Adding the project's first controller integration-test infra would be a separate scope. **Proposing: cover AC-9..AC-13 via use-case unit tests; defer controller-spec infra unless you say otherwise.**
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC #1 (UnenrollStudentUseCase + DELETE route removed) verified pre-satisfied by jvdbpl: Glob src/application/.../unenroll-student.use-case.ts → 0 matches; class.controller.ts has no DELETE :id/enrollments/:enrollmentId route. Proceeding with steps 2–7.
Implementation complete.

Files created (3):
- src/infra/http/dtos/class-management/withdraw-student.request.ts — DTO with @IsEnum(ExitReason) + optional @IsDateString endDate + optional @MaxLength(500) note
- src/application/class-management/use-cases/enrollment/withdraw-student.use-case.ts — input { enrollmentId, campusId, reason, endDate?, note? }; default endDate = new Date(); cross-campus → NotFoundException (404 hide); domain errors mapped: EnrollmentAlreadyClosedException → ConflictException("ENROLLMENT_ALREADY_CLOSED"), InvalidEndDateException → BadRequestException("INVALID_END_DATE: <msg>"); optional note applied via enrollment.update before withdraw
- src/application/class-management/use-cases/enrollment/withdraw-student.use-case.spec.ts — 9 tests covering AC-9..AC-13 + not-found + optional-note + note-omitted

Files modified (4):
- src/infra/http/dtos/class-management/index.ts — barrel export added
- src/application/class-management/use-cases/enrollment/index.ts — barrel export added
- src/infra/http/controllers/class-management/class.controller.ts — added WithdrawStudentUseCase import + constructor injection + POST :id/enrollments/:enrollmentId/withdraw route with full Swagger decorators
- src/infra/http/modules/class-management.module.ts — added WithdrawStudentUseCase import + provider entry

SOLID / Clean Architecture compliance:
- DIP: use case depends on EnrollmentRepository abstract port; @Inject("ENROLLMENT_REPOSITORY") at constructor
- SRP: use case orchestrates lookup → campus check → optional note → entity.withdraw → persist; entity owns invariants; controller is a thin pass-through
- OCP: extends existing controller and module without modifying enroll/get-enrollments behavior
- LSP: full typed mock matches new EnrollmentRepository contract
- Cross-campus check uses 404 (hide existence) per AC-13 — not 403

Verification:
- npx tsc --noEmit → EXIT=0
- npx jest withdraw-student.use-case.spec.ts → 9/9 passed
- npx jest src/application/class-management src/domain/class-management src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts → 110/110 passed across 12 suites (no regressions)
- AC #7 controller integration tests deferred per approved option A (project has no controller-test or e2e harness)
<!-- SECTION:NOTES:END -->

