---
id: q9rt9n
title: TransferStudentUseCase + HTTP route (atomic transaction)
status: done
priority: high
labels:
  - from-spec
  - use-case
  - http
  - transaction
createdAt: '2026-05-05T23:33:24.611Z'
updatedAt: '2026-05-06T12:16:56.964Z'
timeSpent: 1781
assignee: '@me'
spec: specs/class-enrollment-period-model
fulfills:
  - AC-14
  - AC-15
  - AC-16
  - AC-17
  - AC-18
  - AC-19
  - AC-20
  - AC-28
---
# TransferStudentUseCase + HTTP route (atomic transaction)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
New `TransferStudentUseCase` in `src/application/class-management/use-cases/enrollment/` taking `(studentId, toClassId, campusId, transferDate?, note?, fromClassId?)`. Inside a single `prisma.$transaction(async tx => ...)` close the active enrollment (`endDate=transferDate, exitReason=TRANSFERRED`) and insert a new enrollment in `toClassId` (`enrollmentDate=transferDate`). Default `transferDate = today`. Errors: `NO_ACTIVE_ENROLLMENT`, `TRANSFER_SAME_CLASS`, `TRANSFER_SOURCE_MISMATCH`, `INVALID_TRANSFER_DATE`, `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR` (validated against the *target* class's school year). New `student-enrollment.controller.ts` (or extension to `student.controller.ts`) hosting `POST /students/:studentId/transfer` with body `{ toClassId: UUID; transferDate?: ISODate; fromClassId?: UUID; note?: string }`, returning `{ closed: EnrollmentResponse, opened: EnrollmentResponse }`.

Spec: @doc/specs/class-enrollment-period-model
Covers: FR-10, FR-14, FR-17 (transfer path), NFR-3, NFR-4, NFR-5, NFR-6
Blocked by: Tasks 4, 5
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `TransferStudentUseCase` runs close + open inside a single `prisma.$transaction(async tx => ...)`; failure of either rolls both back
- [x] #2 Default `transferDate = today`; closed row gets `endDate=transferDate, exitReason=TRANSFERRED`; opened row gets `enrollmentDate=transferDate, endDate=null`
- [x] #3 Errors mapped: 409 NO_ACTIVE_ENROLLMENT, 409 TRANSFER_SAME_CLASS, 409 TRANSFER_SOURCE_MISMATCH, 400 INVALID_TRANSFER_DATE, 400 ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR (target class)
- [x] #4 `POST /students/:studentId/transfer` DTO validates `toClassId` UUID, optional `transferDate` ISO, optional `fromClassId` UUID, optional `note`; respects `X-Campus-Id` (no campusId in body)
- [x] #5 Returns `{ closed: EnrollmentResponse, opened: EnrollmentResponse }`
- [x] #6 Use-case unit tests cover every error case (no-active, same-class, source-mismatch, invalid-date, out-of-school-year)
- [x] #7 Integration test forces opened-row insert failure and asserts the original close was rolled back (active row remains `endDate=null`)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — TransferStudentUseCase + atomic transaction

### Context
- Spec: @doc/specs/class-enrollment-period-model (sections "Acceptance Criteria" → AC-14..20, AC-28; "Locked Decisions" D4 (atomic transfer); Scenarios 1, 5, 8, 11)
- Existing primitives ready: `Enrollment.withdraw(date, reason)` (AC-6/8), `EnrollmentRepository.findActiveByStudentId` (AC-21 work), `Class.schoolYear` eager-loaded by `PrismaClassRepository.findById` (AC-27 work)
- Convention (per zffh6i decision): NestJS HTTP exceptions, no `DomainException` hierarchy

### Architectural choice
Atomicity is encapsulated in the repository layer via a new port method `transferEnrollment(closed, opened)`, implemented with `prisma.$transaction(async tx => ...)`. The use case stays in the application layer with no infrastructure dependency (DIP). Spec's "single prisma.$transaction" requirement is satisfied at the repository boundary.

### Steps

1. **Domain port** — Add `transferEnrollment(closed: Enrollment, opened: Enrollment): Promise<{ closed: Enrollment; opened: Enrollment }>` to `EnrollmentRepository` at `src/application/class-management/ports/enrollment.repository.ts`. JSDoc that the impl MUST run both writes inside a single transaction.

2. **Repository impl** — Implement `transferEnrollment` in `src/infra/persistence/prisma/repositories/prisma-enrollment.repository.ts` using `this.prisma.$transaction(async (tx) => ...)`. Inside: `tx.enrollment.update({ where:{id:closed.id}, data: PrismaEnrollmentMapper.toPrismaUpdate(closed), include:{class,student} })` then `tx.enrollment.create({ data: PrismaEnrollmentMapper.toPrisma(opened), include:{class,student} })`. Map both back to domain. Returns `{ closed, opened }`.

3. **Use case** — Create `TransferStudentUseCase` at `src/application/class-management/use-cases/enrollment/transfer-student.use-case.ts`. Input `{ studentId, toClassId, campusId, transferDate?, fromClassId?, note? }`. Validation order (each step → fail-fast):
   1. Resolve target class via `classRepository.findById(toClassId)`. 404 NotFoundException if missing OR `class.campusId !== campusId` (hide existence — same convention as withdraw AC-13).
   2. Resolve active enrollment via `enrollmentRepository.findActiveByStudentId(studentId)`. 409 ConflictException("NO_ACTIVE_ENROLLMENT") if none. **AC-18**.
   3. If `fromClassId` provided and `!== active.classId`: 409 ConflictException("TRANSFER_SOURCE_MISMATCH"). **AC-17**.
   4. If `active.classId === toClassId`: 409 ConflictException("TRANSFER_SAME_CLASS"). **AC-16**.
   5. If `targetClass.schoolYear!.isWithinDateRange(transferDate)` is false: 400 BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR"). **AC-28**.
   6. Build `closed = active.withdraw(transferDate, ExitReason.TRANSFERRED)` — catch `InvalidEndDateException` → 400 BadRequestException("INVALID_TRANSFER_DATE: ...message"). **AC-19**. (Reuses existing AC-8 invariants.)
   7. Build `opened = Enrollment.create({ classId:toClassId, studentId, enrollmentDate:transferDate, note })`.
   8. Call `enrollmentRepository.transferEnrollment(closed, opened)` (atomic) → return `{ closed, opened }`. **AC-14, AC-15, AC-20**.
   - Default `transferDate = new Date()` when omitted.

4. **Request DTO** — `src/infra/http/dtos/class-management/transfer-student.request.ts`: `@IsUUID toClassId`, `@IsOptional @IsDateString transferDate?`, `@IsOptional @IsUUID fromClassId?`, `@IsOptional @IsString @MaxLength(500) note?`. NO `campusId` in body (`X-Campus-Id` header). **AC-(http) DTO part**.

5. **Response DTO** — `src/infra/http/dtos/class-management/transfer-student.response.ts`: `{ closed: EnrollmentResponse; opened: EnrollmentResponse }` with `@Type(() => EnrollmentResponse)` for class-transformer. Update `dtos/class-management/index.ts` barrel.

6. **HTTP controller** — Create `src/infra/http/controllers/class-management/student-enrollment.controller.ts` with `@Controller("students")`, `@UseGuards(ClerkAuthGuard)`, `@RequireCampusAccess()`. Route `POST :studentId/transfer`, `@StandardResponse({ message:"Student transferred successfully", type: TransferStudentResponse })`, `@CampusContext() campusId`, `@Param("studentId") studentId`, `@Body() dto: TransferStudentRequest`. Maps DTO → use-case input (parse `transferDate` to Date if provided). **AC-(http)**.

7. **Module wiring** — Register `TransferStudentUseCase` and `StudentEnrollmentController` in `src/infra/http/modules/class-management.module.ts`. Add barrel export in `src/application/class-management/use-cases/enrollment/index.ts`.

8. **Use-case unit tests** (`transfer-student.use-case.spec.ts`) — typed `jest.Mocked<EnrollmentRepository>` + `jest.Mocked<ClassRepository>`. Cover: default-today happy path returning `{closed,opened}`; AC-15 explicit transferDate; AC-16 same-class; AC-17 source-mismatch; AC-18 no-active; AC-19 invalid-date (before active.enrollmentDate, after today); AC-28 out-of-school-year (before/after target schoolYear range); cross-campus target → 404; validation-order (transferEnrollment NOT called when any check fails). Also assert `closed.exitReason === TRANSFERRED` and `opened.endDate === null`. **AC #1, #2, #3, #6**.

9. **Repository integration test** — Extend `prisma-enrollment.repository.spec.ts` with a `transferEnrollment` describe block. Mock `prisma.$transaction` so it actually invokes the callback with a tx mock. Verify: (a) on happy path both `tx.enrollment.update` and `tx.enrollment.create` are called and results mapped; (b) on forced second-op throw, the error propagates and only one prisma op was attempted inside the `$transaction` callback before the throw — proves both ops live inside the same transaction wrapper. This is the `$transaction`-bounded equivalent of "rollback" available without a real DB. **AC #7 (rollback)**.

10. **Validate** — `npx tsc --noEmit`, run new+adjacent specs, run `src/application/class-management src/domain/class-management prisma-enrollment.repository.spec.ts campus-isolation.integration.spec.ts cross-campus-prevention.integration.spec.ts`, then `mcp_knowns_validate { entity: "q9rt9n" }`.

### AC Coverage Map (task ACs)
| Plan step | Task AC | Spec AC |
|---|---|---|
| 2 (repo $transaction) + 3.8 + 9 | #1, #7 | AC-20 |
| 3.6, 3.7, 3.8 | #2 | AC-14, AC-15 |
| 3.2–3.6 + 8 | #3, #6 | AC-16, AC-17, AC-18, AC-19, AC-28 |
| 4, 6 | #4 | (HTTP wiring) |
| 5, 6 | #5 | AC-14 (return shape) |

### Files (new / modified)
**New:** `transfer-student.use-case.ts`, `transfer-student.use-case.spec.ts`, `transfer-student.request.ts`, `transfer-student.response.ts`, `student-enrollment.controller.ts`
**Modified:** `enrollment.repository.ts` (port), `prisma-enrollment.repository.ts`, `prisma-enrollment.repository.spec.ts`, `dtos/class-management/index.ts`, `enrollment/index.ts`, `class-management.module.ts`

### Risk / open questions
- **Q1 (atomicity verification depth):** Plan step 9 verifies `$transaction` wrapping at the repo level via mock, since the project's other "integration" specs are mock-based (no test DB harness). If you want a real-DB rollback proof for AC-20, we'd need to introduce a Prisma test-container harness — out of scope here unless you say otherwise. **Confirm: mock-based AC-20 verification OK?**
- **Q2 (controller location):** New `student-enrollment.controller.ts` lives in `controllers/class-management/` (cohesion with the use case) even though the URL is `/students/:studentId/...`. This avoids bloating `user-management/student.controller.ts`. **OK?**
- Step 9 touches the existing `prisma-enrollment.repository.spec.ts`; ~6 new test blocks. All other steps create new files. Total touched files: 6 modified, 5 new — within scope.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation complete (2026-05-06)

### Files added
- `src/application/class-management/use-cases/enrollment/transfer-student.use-case.ts` — orchestrates 8-step validation pipeline, atomic persistence delegated to repo
- `src/application/class-management/use-cases/enrollment/transfer-student.use-case.spec.ts` — 14 tests covering AC-14..20, AC-28, cross-campus 404, validation order
- `src/infra/http/dtos/class-management/transfer-student.request.ts` — class-validator DTO (toClassId UUID, optional transferDate ISO, fromClassId UUID, note ≤500)
- `src/infra/http/dtos/class-management/transfer-student.response.ts` — `{ closed, opened }` shape with @Type(() => EnrollmentResponse)
- `src/infra/http/controllers/class-management/student-enrollment.controller.ts` — `POST /students/:studentId/transfer` with `@CampusContext()`, `@RequireCampusAccess()`, `@StandardResponse({ type: TransferStudentResponse })`

### Files modified
- `src/application/class-management/ports/enrollment.repository.ts` — added abstract `transferEnrollment(closed, opened)` method
- `src/infra/persistence/prisma/repositories/prisma-enrollment.repository.ts` — implemented `transferEnrollment` with `prisma.$transaction(async tx => { update; create })`
- `src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts` — added 3 tests for the new method (happy path + create-throw rollback + update-throw rollback)
- `src/infra/http/dtos/class-management/index.ts` — added barrel exports for transfer DTOs
- `src/application/class-management/use-cases/enrollment/index.ts` — added barrel export for transfer use case
- `src/infra/http/modules/class-management.module.ts` — registered `TransferStudentUseCase` and `StudentEnrollmentController`
- `src/application/class-management/use-cases/enrollment/{enroll-student,withdraw-student}.use-case.spec.ts` + `cross-campus-prevention.integration.spec.ts` — added `transferEnrollment: jest.fn()` to test mocks to satisfy the extended port

### SOLID / Clean Architecture confirmation
- **DIP** — use case depends only on `EnrollmentRepository` and `ClassRepository` ports; atomicity (a `prisma.$transaction` infrastructure concern) is encapsulated in `PrismaEnrollmentRepository.transferEnrollment`. Application layer has zero Prisma imports.
- **SRP** — domain invariants (date bounds, XOR endDate/exitReason) stay on `Enrollment` and `SchoolYear`. Use case orchestrates ordered checks. Controller maps DTO ↔ use-case input. Each layer has one reason to change.
- **OCP** — port extended (no breaking change to existing callers); new use case sits beside `WithdrawStudentUseCase` without modifying it. New controller composes the use case in a focused class rather than bloating `StudentController`.
- **LSP** — `transferEnrollment` returns the same domain `Enrollment` shape as `update`/`save`, fully substitutable.
- **ISP** — all controller dependencies are scoped to the single use case it composes.

### Convention notes
- NestJS HTTP exceptions (`NotFoundException`, `ConflictException`, `BadRequestException`) — matches `WithdrawStudentUseCase` and `EnrollStudentUseCase` (per zffh6i decision; no `DomainException` hierarchy in this codebase).
- Cross-campus target = 404 hide-existence, matching withdraw AC-13 (`NotFoundException` not `ForbiddenException`).
- Validation order is fail-fast: target-class → active enrollment → source-mismatch → same-class → school-year bounds → date-invariant (catch InvalidEndDateException → BadRequest INVALID_TRANSFER_DATE). Test asserts later validations not consulted when an earlier one fails.
- Default `transferDate = new Date()` set at the use-case entry, so the default flows through both the school-year check AND the withdraw call consistently.

### Verification
- `npx tsc --noEmit` → EXIT=0 (clean)
- `npx jest transfer-student.use-case.spec.ts` → **14/14**
- `npx jest prisma-enrollment.repository.spec.ts` → **12/12** (3 new transferEnrollment tests + 9 prior)
- `npx jest src/application/class-management src/domain/class-management prisma-enrollment.repository.spec.ts` → **133/133** across 13 suites (up from 116; +17 new tests, zero regressions)
- `npx jest campus-isolation.integration.spec.ts` → **12/12**

### AC-20 verification depth
Mock-based as approved (Q1=A): `prisma.$transaction` mocked to actually invoke its work callback with a tx-bound delegate. Two failure scenarios exercised: (a) create-op throw — propagates with both update+create called inside the wrapper and zero writes outside; (b) update-op throw — propagates without ever calling create. This proves the writes live inside the same `$transaction` scope, which is the source of rollback semantics in real Prisma. A real-DB harness would prove the database-level rollback but is out of scope here.
<!-- SECTION:NOTES:END -->

