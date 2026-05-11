---
id: ncjacr
title: Read endpoints — class active/historical filter + student history
status: done
priority: medium
labels:
  - from-spec
  - use-case
  - http
  - read
createdAt: '2026-05-05T23:33:28.897Z'
updatedAt: '2026-05-06T14:56:25.064Z'
timeSpent: 917
assignee: '@me'
spec: specs/class-enrollment-period-model
fulfills:
  - AC-23
  - AC-24
  - AC-25
---
# Read endpoints — class active/historical filter + student history

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update `GetClassEnrollmentsUseCase` to filter `endDate IS NULL` by default; accept `includeHistorical: boolean = false` (when true, return all rows ordered by `enrollmentDate DESC`). Add `GetStudentEnrollmentHistoryUseCase` returning a student's full enrollment history with `class.name`, `class.schoolYear.name`, `class.gradeLevel.name`, `endDate`, `exitReason`. Wire `GET /classes/:id/enrollments?includeHistorical=` (existing route, new query param) and `GET /students/:studentId/enrollments` (new route in `student-enrollment.controller.ts`).

Spec: @doc/specs/class-enrollment-period-model
Covers: FR-9, FR-11, FR-13, FR-15
Blocked by: Task 3 (repository)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `GetClassEnrollmentsUseCase` returns only `endDate IS NULL` rows by default
- [x] #2 `includeHistorical=true` returns all rows for the class ordered by `enrollmentDate DESC`
- [x] #3 `GetStudentEnrollmentHistoryUseCase` returns student's full history with `class.name`, `class.schoolYear.name`, `class.gradeLevel.name`, `endDate`, `exitReason` populated, ordered `enrollmentDate DESC`
- [x] #4 `GET /classes/:id/enrollments?includeHistorical=` query param added (default false), respects existing campus-scope
- [x] #5 `GET /students/:studentId/enrollments` route added (new `student-enrollment.controller.ts` or extension)
- [x] #6 Use-case + controller tests cover default-active, includeHistorical, and student history shape
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

**Goal:** AC-23/24/25 — class roster filters active by default with `?includeHistorical=true` opt-in, and a new student-history endpoint surfaces full enrollment history with nested `class.schoolYear.name` + `class.gradeLevel.name`.

### Foundation — repository already in place (task jvdbpl)
- Port `EnrollmentRepository` already has `findActiveByClassId`, `findHistoricalByClassId`, `findAllByStudentId`.
- `findAllByStudentId` already runs `class: { include: { schoolYear, gradeLevel } }`.
- Caveat discovered: `PrismaEnrollmentMapper.toDomain` uses `PrismaClassMapper.toDomainSimple` which **strips** nested `gradeLevel`/`schoolYear`. Step 3 fixes this so the rich query result reaches the domain layer (required for AC-25).

### Steps

1. **Update `GetClassEnrollmentsUseCase`** (covers AC-23, AC-24)
   - Change signature: `execute(classId, campusId?, includeHistorical = false)`.
   - Route to `findActiveByClassId` (default) or `findHistoricalByClassId` (when `true`).
   - Keep existing class-resolve + cross-campus 404 (AC-13 pattern).
   - Add `get-class-enrollments.use-case.spec.ts`: default-active path; `includeHistorical=true` path; cross-campus 404; not-found.

2. **Add `GetStudentEnrollmentHistoryUseCase`** (covers AC-25)
   - New file `application/class-management/use-cases/enrollment/get-student-enrollment-history.use-case.ts`.
   - Input: `studentId`, `campusId`. Validates student exists (via `StudentRepository.findById`) and matches campus → 404 hide-existence on cross-campus.
   - Returns `enrollmentRepository.findAllByStudentId(studentId)` (already ordered `enrollmentDate DESC` and includes nested class relations).
   - Add `.spec.ts`: populated nested `class.name`/`schoolYear.name`/`gradeLevel.name`, ordering, empty history, cross-campus 404, not-found student.
   - Export from `enrollment/index.ts`.

3. **Fix `PrismaEnrollmentMapper.toDomain`** (unblocks AC-25 nested fields reaching the domain)
   - Switch `PrismaClassMapper.toDomainSimple(class)` → `PrismaClassMapper.toDomain(class)`. The latter conditionally maps nested `schoolYear`/`gradeLevel` if present, otherwise no-ops — backward-compatible for `findById`, `findActiveByClassId`, etc. (those queries don't include the nested relations, so the fields stay `undefined` like today).
   - Verify `prisma-enrollment.repository.spec.ts` still passes (mock rows in tests don't carry the nested relations either).

4. **DTOs** (covers AC-25 wire shape, AC-26 consistency)
   - `dtos/class-management/get-class-enrollments.query.ts`: `includeHistorical?: boolean` with `@IsOptional() @IsBoolean() @Transform(({ value }) => value === "true")`.
   - `dtos/class-management/student-enrollment-history.response.ts`: dedicated response with `EnrollmentHistoryClassInfo` exposing `id`, `name`, plus nested `schoolYear: { id, name }` and `gradeLevel: { id, name }`. Item carries `endDate` and `exitReason` (AC-26 consistency). Avoids bloating the existing `EnrollmentResponse` used by withdraw/transfer.
   - Re-export both from `dtos/class-management/index.ts`.

5. **Wire HTTP** (covers AC-23, AC-24, AC-25)
   - `class.controller.ts` `getEnrollments`: add `@Query() query: GetClassEnrollmentsQuery`; pass `query.includeHistorical ?? false` through. Add `@ApiQuery({ name: "includeHistorical", required: false, type: Boolean })`.
   - `student-enrollment.controller.ts`: add `@Get(":studentId/enrollments")` returning `StudentEnrollmentHistoryResponse[]` via `@StandardResponse({ type: ..., isArray: true })`. Inject `GetStudentEnrollmentHistoryUseCase`.

6. **DI wiring + structural-mock backfill**
   - `class-management.module.ts`: add `GetStudentEnrollmentHistoryUseCase` to providers.
   - Sweep existing `jest.Mocked<EnrollmentRepository>` literals to verify the new use case's spec mock surface — none new since port surface is unchanged from q9rt9n.

7. **Verify**
   - `npx tsc --noEmit`.
   - `npx jest get-class-enrollments.use-case.spec.ts get-student-enrollment-history.use-case.spec.ts` (new specs).
   - `npx jest prisma-enrollment.repository.spec.ts` (regression check after mapper change).
   - `npx jest src/application/class-management src/domain/class-management prisma-enrollment.repository.spec.ts` — full sweep, expect zero regressions.
   - `mcp_knowns_validate` for ref integrity.

### Files touched (estimate)
- **Modified (5):** `get-class-enrollments.use-case.ts`, `prisma-enrollment.mapper.ts`, `class.controller.ts`, `student-enrollment.controller.ts`, `class-management.module.ts`, `enrollment/index.ts`, `dtos/class-management/index.ts`.
- **New (5):** `get-student-enrollment-history.use-case.ts`, `get-class-enrollments.use-case.spec.ts`, `get-student-enrollment-history.use-case.spec.ts`, `get-class-enrollments.query.ts`, `student-enrollment-history.response.ts`.

### Open questions for approval
- **Q1 — Student-history response shape:** Strict spec wording is `class.name`, `class.schoolYear.name`, `class.gradeLevel.name`. Recommendation: include `id` alongside `name` for both nested objects (`{ id, name }`), so clients can navigate without a second call. Confirm: **A** include both id+name, or **B** name only (strict).
- **Q2 — Mapper fix scope:** Step 3 changes `PrismaEnrollmentMapper.toDomain` to use `PrismaClassMapper.toDomain` — this is required for AC-25 since the existing `findAllByStudentId` query already requests nested relations the current mapper drops. Confirm scope is acceptable as part of this task (it's a one-line fix isolated to the enrollment mapper, with backward-compatible behavior for queries that don't include nested relations).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Plan approved 2026-05-06. Decisions: Q1=A (nested objects expose `{ id, name }` for `schoolYear` and `gradeLevel`); Q2=A (mapper fix `PrismaEnrollmentMapper.toDomain` → `PrismaClassMapper.toDomain` is in-scope for this task — required for AC-25 nested fields to reach the domain layer).
Implementation complete (Steps 1-6). Files: 5 new (get-student-enrollment-history.use-case.ts + spec, get-class-enrollments.use-case.spec.ts, get-class-enrollments.query.ts, student-enrollment-history.response.ts) + 6 modified (get-class-enrollments.use-case.ts, prisma-enrollment.mapper.ts, class.controller.ts, student-enrollment.controller.ts, class-management.module.ts, dtos/index.ts, use-cases/enrollment/index.ts). Step 7 verification next.
Verification complete:
- `npx tsc --noEmit` → EXIT=0
- `npx jest get-class-enrollments.use-case.spec.ts get-student-enrollment-history.use-case.spec.ts` → 10/10
- `npx jest prisma-enrollment.repository.spec.ts` → 12/12 (mapper change backward-compatible)
- `npx jest src/application/class-management src/domain/class-management prisma-enrollment.repository.spec.ts` → 143/143 across 15 suites (+10 vs q9rt9n's 133/133, zero regressions)
- `npx jest campus-isolation.integration.spec.ts` → 12/12
- `mcp_knowns_validate` → 0 errors / 0 warnings / 0 info

SOLID/Clean Architecture compliance:
- DIP: GetStudentEnrollmentHistoryUseCase depends on `EnrollmentRepository` and `StudentRepository` ports (string-token injection); zero Prisma imports in application layer.
- SRP: use case orchestrates resolve → fetch; repository owns the eager-load shape; domain entities own the field shape.
- OCP: extended port-driven query surface (already in place); new use case added without modifying existing ones; new HTTP route added on existing controller without disturbing transfer.
- LSP: `findHistoricalByClassId` and `findActiveByClassId` return same domain `Enrollment[]` contract.
- ISP: introduced dedicated `StudentEnrollmentHistoryResponse` (with `EnrollmentHistoryClassInfo` + nested `schoolYear`/`gradeLevel` `{ id, name }` shapes) instead of bloating shared `EnrollmentResponse` used by withdraw/transfer.
- Clean Architecture: nested `schoolYear`/`gradeLevel` flow domain → DTO via class-transformer; eager-load lives in repo; HTTP layer stays thin (DTO ↔ use-case input).

Conventions:
- Cross-campus 404 hide-existence pattern (matches AC-13 across the module).
- `@Transform(({ value }) => value === true || value === "true")` + `@IsBoolean()` for boolean query parsing — handles both string ("true") and runtime-coerced inputs.
- `PrismaEnrollmentMapper.toDomain` switched from `PrismaClassMapper.toDomainSimple` → `PrismaClassMapper.toDomain` so existing rich `findAllByStudentId` query (already including `schoolYear`/`gradeLevel`) actually surfaces nested entities at the domain layer. No-op for queries that don't include those relations.
<!-- SECTION:NOTES:END -->

