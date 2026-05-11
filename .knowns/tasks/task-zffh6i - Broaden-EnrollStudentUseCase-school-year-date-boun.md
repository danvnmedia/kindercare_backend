---
id: zffh6i
title: Broaden EnrollStudentUseCase + school-year date bounds
status: done
priority: high
labels:
  - from-spec
  - use-case
createdAt: '2026-05-05T23:33:16.052Z'
updatedAt: '2026-05-06T11:18:17.144Z'
timeSpent: 28168
assignee: '@me'
spec: specs/class-enrollment-period-model
fulfills:
  - AC-21
  - AC-22
  - AC-27
---
# Broaden EnrollStudentUseCase + school-year date bounds

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update `EnrollStudentUseCase` in `src/application/class-management/use-cases/enrollment/enroll-student.use-case.ts` to reject when student has *any* active enrollment (use new `findActiveByStudentId`), not just same class → `STUDENT_ALREADY_ENROLLED` (409). Add school-year date-bounds check on `enrollmentDate` against `class.schoolYear.startDate/endDate` → `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR` (400). Validation order: campus-scope → school-year bounds → already-enrolled → persistence. Update `enroll-student.use-case.spec.ts` for new error paths.

Spec: @doc/specs/class-enrollment-period-model
Covers: FR-8, FR-17 (enroll path), NFR-5, NFR-6
Blocked by: Task 3 (repository)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Already-enrolled check uses `findActiveByStudentId` (any class), not class-scoped lookup → `STUDENT_ALREADY_ENROLLED` (409)
- [x] #2 School-year date-bounds check rejects `enrollmentDate` outside `[class.schoolYear.startDate, class.schoolYear.endDate]` → `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR` (400)
- [x] #3 Validation order: campus-scope → school-year bounds → already-enrolled → persistence
- [x] #4 After withdraw on prior class, re-enroll into any class succeeds (regression)
- [x] #5 `enroll-student.use-case.spec.ts` updated for new error paths and broadened active check
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

**Context:** EnrollmentRepository.findActiveByStudentId already exists (jvdbpl). PrismaClassRepository.findById already eager-loads schoolYear, so class.schoolYear is reliable in production. SchoolYear exposes isWithinDateRange(date). Test factory createClass currently builds a Class without the schoolYear relation — needs extension.

Spec ref: @doc/specs/class-enrollment-period-model (FR-8, FR-17 enroll path; ACs 21, 22, 27; Scenarios 4, 9, 10; NFR-5/6)

### Steps

1. **Update EnrollStudentUseCase** in src/application/class-management/use-cases/enrollment/enroll-student.use-case.ts to enforce the new validation order:
   1. class exists → NotFoundException
   2. class.campusId === input.campusId → BadRequestException ("Class does not belong to this campus") — unchanged
   3. student exists → NotFoundException
   4. student.campusId === input.campusId → BadRequestException — unchanged
   5. **NEW** school-year bounds: `classEntity.schoolYear!.isWithinDateRange(input.enrollmentDate)` → false → `BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR")`
   6. **NEW** active-anywhere: `enrollmentRepository.findActiveByStudentId(input.studentId)` → non-null → `ConflictException("STUDENT_ALREADY_ENROLLED")`
   7. existing same-date duplicate check via `findByStudentClassDate` — kept (composite-key safety, returns 409 with the existing message)
   8. save
   - Use NestJS HTTP exceptions per existing project convention (NFR-5 mentions "DomainException hierarchy" but no such class exists in repo — flagged below).
   - The schoolYear non-null assertion is safe because PrismaClassRepository.findById always includes it; keeping it explicit signals the dependency.

2. **Extend createClass test factory** in src/test-utils/entity-factories.ts to optionally accept a SchoolYear relation, defaulting to a wide range (e.g., 2020-01-01 to 2030-12-31) so existing tests continue to pass with realistic data:
   - Add `schoolYear?: SchoolYear` to overrides type
   - Default-build a SchoolYear via `SchoolYear.create({...wide range, campusId})` and attach via Class.create's `schoolYear` prop
   - Existing call sites need no changes (broad default)

3. **Update enroll-student.use-case.spec.ts** in src/application/class-management/use-cases/enrollment/:
   - Update local `createMockClass` to also include a SchoolYear with default wide range; add an optional `schoolYearRange?: { startDate; endDate }` override for the bounds tests
   - Set `mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null)` in beforeEach (default no-active) so existing happy-path tests continue
   - Existing test "duplicate enrollment exists on same date" still works (active=null fall-through)
   - **AC-21 / Scenario 9**: new test — student already active in another class → `ConflictException("STUDENT_ALREADY_ENROLLED")`
   - **AC-22 / Scenario 4**: regression test — after withdraw (active=null), enrollment in any class succeeds; assert findActiveByStudentId returned null and save was called
   - **AC-27 / Scenario 10**: two new tests — enrollmentDate before schoolYear.startDate → `BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR")`, enrollmentDate after schoolYear.endDate → same
   - Validation-order test: when both school-year bounds and active-anywhere would fail, school-year fires first (campus-scope still fires before both)

4. **Verify cross-campus-prevention.integration.spec.ts** continues to pass:
   - Its happy-path test uses `new Date()` (today) as enrollmentDate; the broadened createClass default (2020-2030 SchoolYear) covers today.
   - Its `findActiveByStudentId` mock returns undefined by default → falsy → no false-positive STUDENT_ALREADY_ENROLLED.
   - "should validate class campus before checking student campus" still holds — campus-scope is still step 2.
   - No code changes expected; verify via test run.

5. **Validate**:
   - `npx tsc --noEmit` clean
   - `npx jest enroll-student.use-case.spec.ts` → all green
   - `npx jest cross-campus-prevention.integration.spec.ts` → all green
   - `npx jest src/application/class-management src/domain/class-management src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts` → no regressions across the whole class-management/domain surface (createClass factory change has cross-cutting reach)
   - `mcp_knowns_validate({ entity: "zffh6i" })` → 0 errors
   - Append notes, check ACs, stop timer, mark done; SDD workflow.

### Scope sizing
3 files modified — fits one session. Test-factory change is additive (default-build SchoolYear) so backwards compatible.

### Plan-quality notes
- **NFR-5 vs project reality:** NFR-5 says "use the project's existing DomainException hierarchy". `Grep DomainException src/` returns 0 matches — no such hierarchy exists. The existing EnrollStudentUseCase, the just-shipped WithdrawStudentUseCase (q0oqvy), and the global filter all use NestJS HTTP exceptions directly. Sticking with that convention; flagging that NFR-5's wording may be aspirational rather than descriptive of current state.
- **Existing same-date check kept**: spec doesn't ask to remove it. It's a defensive layer against the (studentId, classId, enrollmentDate) composite-key DB constraint and provides a clearer error than a raw Prisma unique-violation. Leaving it in place after the new active-anywhere check.
- **Test factory generalization**: `createClass` is widely used in tests. Default SchoolYear with broad range (2020–2030) means all existing assertions continue to pass; only the new school-year-bounds tests will override. Cross-cutting risk mitigated by running the full class-management/domain test suite as part of validation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete.

Files modified (3):
- src/application/class-management/use-cases/enrollment/enroll-student.use-case.ts — inserted school-year-bounds check (step 3) and active-anywhere check (step 4) between campus-scope and the existing same-date duplicate check; uses class.schoolYear!.isWithinDateRange(date) (PrismaClassRepository always loads schoolYear); errors map to BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR") and ConflictException("STUDENT_ALREADY_ENROLLED")
- src/test-utils/entity-factories.ts — extended createClass to default-attach a SchoolYear (2020-01-01 → 2030-12-31); added optional `schoolYear` override; aligns schoolYearId with override id when provided
- src/application/class-management/use-cases/enrollment/enroll-student.use-case.spec.ts — local createMockClass now builds SchoolYear with `schoolYearRange` override; beforeEach defaults findActiveByStudentId.mockResolvedValue(null); +6 new tests (AC-21, AC-22 regression, AC-27 before/after/inclusive-boundary, validation-order)

SOLID / Clean Architecture compliance:
- DIP: dependency on EnrollmentRepository abstract port unchanged; no new infra-layer leaks into the use case
- SRP: use case orchestrates eight ordered checks; SchoolYear.isWithinDateRange owns the date-range domain rule (entity, not use case)
- OCP: existing same-date duplicate check kept as a defensive composite-key layer; new checks added in front of it without modifying it
- LSP: createClass test factory now consistently provides a fully-loaded Class (schoolYear relation), matching production's PrismaClassRepository.findById behavior
- ISP: only the two newly-needed methods (findActiveByStudentId, isWithinDateRange) are touched at call sites

Verification:
- npx tsc --noEmit → EXIT=0
- npx jest enroll-student.use-case.spec.ts + cross-campus-prevention.integration.spec.ts → 22/22 passed
- npx jest src/application/class-management src/domain/class-management prisma-enrollment.repository.spec.ts → 116/116 across 12 suites (no regressions; up from 110 since new tests added)
- npx jest campus-isolation.integration.spec.ts (other createClass consumer outside the main run) → 12/12
- mcp_knowns_validate(zffh6i) → 0 errors

Convention note: NFR-5 mentions a "DomainException hierarchy"; verified absent (Grep DomainException src/ → 0 hits). Continued project convention of NestJS HTTP exceptions in the use-case layer per approved option A.
<!-- SECTION:NOTES:END -->

