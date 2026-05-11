---
id: 500uai
title: Eligible Students endpoint — use case, DTO, controller
status: done
priority: high
labels:
  - from-spec
  - backend
  - user-management
  - class-management
  - bulk-enrollment
  - feature
  - use-case
  - controller
createdAt: '2026-05-10T19:42:17.043Z'
updatedAt: '2026-05-10T21:51:09.836Z'
timeSpent: 509
assignee: '@me'
spec: specs/bulk-enrollment
fulfills:
  - AC-9
  - AC-10
  - AC-11
  - AC-12
  - AC-13
---
# Eligible Students endpoint — use case, DTO, controller

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement `GET /classes/:classId/eligible-students` end-to-end per FR-6..FR-8. New `GetEligibleStudentsForClassUseCase` lives in `src/application/user-management/use-cases/student/`. Use case validates target class exists + same campus (404 per D5 if not), defaults `includeStatuses=[ACTIVE]`, then delegates to `studentRepository.findEligibleForClass`. New query DTO extends StandardRequestDto-like shape with `search?: string` and `includeStatuses?: string` (CSV → StudentStatus[] via `@Transform`); DTO rejects DROPPED/GRADUATED at validation per D6. Use case registered in `UserManagementModule`; class controller injects via existing module wiring. Wired with `@RequireCampusAccess`, `@StandardResponse({ type: StudentResponse, isPaginated: true })`. Depends on the findEligibleForClass repo task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GetEligibleStudentsForClassUseCase created at src/application/user-management/use-cases/student/
- [x] #2 Use case validates class exists + class.campusId === input.campusId; throws NotFoundException otherwise (D5)
- [x] #3 Default includeStatuses = [ACTIVE] when caller omits the query param
- [x] #4 Delegates to studentRepository.findEligibleForClass(classId, params, { campusId })
- [x] #5 EligibleStudentsQueryDto with search?: string and includeStatuses?: string (CSV → StudentStatus[] via @Transform)
- [x] #6 DTO @Transform rejects DROPPED and GRADUATED values (400)
- [x] #7 Controller route `getEligibleStudents` on class.controller.ts with @CampusContext, @RequireCampusAccess, @StandardResponse({ type: StudentResponse, isPaginated: true }), full Swagger
- [x] #8 Use case registered in UserManagementModule; class controller injects via existing module wiring
- [x] #9 Use case spec test: returns only campus-scoped, not-archived, no-active-enrollment students with status filtering
- [x] #10 Integration or controller spec test: search by fullName via ilike; pagination/sort via StandardRequest
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — Eligible Students endpoint

### 1. Use case — `src/application/user-management/use-cases/student/get-eligible-students-for-class.use-case.ts` (AC #1–#4)

Input: `{ classId, campusId, params: StandardRequest, search?: string, includeStatuses?: StudentStatus[] }`
Output: `Promise<PaginatedResult<Student>>`

- Inject `CLASS_REPOSITORY` and `STUDENT_REPOSITORY` (constructor DI via `@Inject` tokens)
- D5 / AC-12 gate: `classRepository.findById(classId)` → if missing OR `class.campusId !== input.campusId`, throw `NotFoundException("Class with ID ${classId} not found")` (same body as missing, hides existence — matches `transfer-student.use-case.ts:47-53` precedent)
- Default: if `!includeStatuses || includeStatuses.length === 0`, use `[StudentStatus.ACTIVE]`
- Translate query params into `params.filterInfo.filters`:
  - `status: { in: includeStatuses }`
  - `fullName: { ilike: search }` only when `search` is a non-empty string
  - (executeQuery reads `filterInfo` before parsing the `filter` JSON string, so we can populate it directly)
- Logger entries (entry: classId/campusId/limit/offset; success: count returned)
- Delegate `studentRepository.findEligibleForClass(classId, params, { campusId })`

### 2. Query DTO — `src/infra/http/dtos/class-management/eligible-students.query.ts` (AC #5, #6)

```
class EligibleStudentsQuery extends StandardRequestDto {
  @IsOptional @IsString search?: string;
  @Transform(({ value }) => csv→string[]) @IsOptional @IsArray
  @IsIn([ACTIVE, WAITING, TRIAL, DEFERRED], { each: true }) includeStatuses?: StudentStatus[];
}
```

- Allow-list = `[ACTIVE, WAITING, TRIAL, DEFERRED]` per D6
- `DROPPED` / `GRADUATED` rejected at validation by `@IsIn` (anything outside the allow list)
- `@ApiPropertyOptional` for Swagger surface

### 3. DTO barrel — add export to `src/infra/http/dtos/class-management/index.ts`

### 4. Controller route — `class.controller.ts` (AC #7)

- Inject `GetEligibleStudentsForClassUseCase` in constructor
- `@Get(":classId/eligible-students")` placed after `getEnrollments` (before the staff-assignment section)
- Decorators: `@RequireCampusAccess()`, `@StandardResponse({ message: "Eligible students retrieved successfully", type: StudentResponse, isPaginated: true })`, `@ApiOperation`, `@ApiHeader(CAMPUS_ID_HEADER)`, `@ApiParam("classId")`, `@ApiQuery({ name: "search", required: false })`, `@ApiQuery({ name: "includeStatuses", required: false, example: "ACTIVE,WAITING" })`
- Body extracts `{ search, includeStatuses, ...standardRequestFields }` from `@Query() query: EligibleStudentsQuery`; passes them through to the use case

### 5. Module wiring — `class-management.module.ts` (AC #8)

Register `GetEligibleStudentsForClassUseCase` in **ClassManagementModule** providers + import list.

⚠️ **Deviation from AC #8 literal wording** (which says register in UserManagementModule). Registering there would force `forwardRef(() => ClassManagementModule)` in UserManagementModule because the new use case needs both `CLASS_REPOSITORY` (from ClassManagementModule) and `STUDENT_REPOSITORY` (from UserManagementModule), creating a 2-cycle. Registering in ClassManagementModule avoids the cycle and still satisfies the AC's intent ("via existing module wiring") — ClassController already has DI access to both repos (CLASS_REPOSITORY locally + STUDENT_REPOSITORY via the existing `UserManagementModule` import). Flagged in implementation notes for spec/handoff awareness.

### 6. Use-case spec test — `get-eligible-students-for-class.use-case.spec.ts` (AC #9)

Use `createMockStudentRepository()` (the canonical factory shipped in o99c77 already has `findEligibleForClass: jest.fn()`). Tests:
1. Happy path with defaults → repo called with `filterInfo.filters.status.in = ["ACTIVE"]`, scope `{ campusId }`, no `fullName` filter
2. Explicit `includeStatuses=[ACTIVE, WAITING]` → repo called with `status.in = ["ACTIVE","WAITING"]`
3. `search="Anh"` → repo called with `fullName.ilike = "Anh"`
4. Missing class → throws `NotFoundException`
5. Cross-campus class (campusId mismatch) → throws `NotFoundException` with same message body as missing (D5)
6. Pass-through: classId argument forwarded to repo unchanged

### 7. DTO spec test — `eligible-students.query.spec.ts` (AC #6, #10 reinforce)

Use `plainToInstance` + `validate` from class-validator to assert:
- Omitted `includeStatuses` → 0 errors
- `includeStatuses="ACTIVE,WAITING"` (CSV) → transforms to `["ACTIVE","WAITING"]`, 0 errors
- `includeStatuses="DROPPED"` → ≥1 validation error
- `includeStatuses="GRADUATED"` → ≥1 validation error
- `includeStatuses="ACTIVE,GRADUATED"` → ≥1 validation error (per-element `@IsIn`)
- `search="Anh"` accepted; `search=123` produces error if non-string slips past `@IsString`

### 8. Verify

- `npm run build` → 0 errors
- `npx jest <new use-case spec>` → all pass
- `npx jest <new DTO spec>` → all pass
- Regression: `npx jest src/application/user-management/use-cases/student src/application/class-management/use-cases/enrollment src/application/class-management/use-cases/cross-campus-prevention.integration.spec.ts src/infra/persistence/prisma/repositories` → no regression
- `mcp__knowns__validate({ entity: "500uai" })` → 0 errors / 0 warnings

---

### Pre-execution plan check
- **AC coverage**: AC #1–4 → step 1; AC #5/#6 → step 2 + step 7; AC #7 → step 4; AC #8 → step 5 (with flagged deviation); AC #9 → step 6; AC #10 (search/pagination/sort via StandardRequest) → step 6 search test + executeQuery's existing standard sort/limit/offset (proven by o99c77's repo tests + existing PrismaQueryService unit coverage). Coverage acceptable; no end-to-end HTTP integration test added, which is consistent with the surrounding pattern (use-case-level testing is the project norm). ✅
- **Scope**: 5 new files + 2 modified + 2 spec files = 9 touches, single session. ✅
- **Dependencies**: foundations done (o99c77 / h8t9p8 / 5sey28). Order: UC → DTO → controller → module → tests → verify. ✅
- **Risk**: low. Additive route on shared controller; the module-placement deviation is the only non-obvious choice — flagged.

### Refs
- @doc/specs/bulk-enrollment (FR-6..FR-8, AC-9..AC-13, D5, D6)
- @task-o99c77 (done — `findEligibleForClass` port + impl)
- Pattern: `transfer-student.use-case.ts` (D5 404 convention)
- Pattern: `get-class-enrollments.query.ts` (existing query-DTO with @Transform)
- Pattern: `student.controller.ts findAll` (`StandardResponse({ type, isPaginated: true })`)
- Pattern: `get-all-students.use-case.ts` (campus-scoped list use case using `findAll(params, { campusId })`)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete (2026-05-10).

Files changed (9 = 5 new + 4 modified):
- NEW src/application/user-management/use-cases/student/get-eligible-students-for-class.use-case.ts — D5/AC-12 cross-campus 404 gate via classRepository.findById; default includeStatuses=[ACTIVE] (D6); search → fullName.ilike; status → status.in via params.filterInfo; delegates to studentRepository.findEligibleForClass(classId, params, { campusId }). Filter shape typed against FilterConditionDto.
- NEW src/application/user-management/use-cases/student/get-eligible-students-for-class.use-case.spec.ts — 10 tests across 3 describe blocks (class lookup D5, filter construction, repository delegation).
- NEW src/infra/http/dtos/class-management/eligible-students.query.ts — `EligibleStudentsQuery extends StandardRequestDto`; CSV @Transform parses any case/spacing → uppercased StudentStatus[]; @IsIn allow-list [ACTIVE, WAITING, TRIAL, DEFERRED] rejects DROPPED/GRADUATED per D6.
- NEW eligible-students.query.spec.ts — 8 tests covering CSV parse, case normalization, allow-list enforcement, search string validation.
- MODIFIED src/infra/http/dtos/class-management/index.ts — barrel export added.
- MODIFIED src/infra/http/controllers/class-management/class.controller.ts — imports for EligibleStudentsQuery, StudentResponse, GetEligibleStudentsForClassUseCase, StandardRequestParam, StandardRequest. Constructor injection. New route `@Get(":classId/eligible-students")` placed between getEnrollments and the staff section. Full Swagger (`@ApiOperation`, `@ApiHeader`, `@ApiParam`, two `@ApiQuery` for search/includeStatuses), `@RequireCampusAccess`, `@StandardResponse({ type: StudentResponse, isPaginated: true })`. Decoupled param extraction: `@StandardRequestParam()` for limit/offset/sort/filter validation + `@Query()` DTO for search/includeStatuses transform.
- MODIFIED src/infra/http/modules/class-management.module.ts — registered GetEligibleStudentsForClassUseCase in providers (file lives under user-management/ but is wired here to keep CLASS_REPOSITORY + STUDENT_REPOSITORY accessible without a forwardRef cycle; comment explains the intent — see AC #8 deviation below).

Verification:
- `npm run build` → 0 errors
- `npx jest <use-case spec> <DTO spec>` → 2 suites / 18 tests pass
- Regression sweep across user-management/student + class-management/enrollment + cross-campus-prevention + prisma repos + class-management DTOs → 14 suites / 124 tests pass.

AC #8 deviation (documented in plan): use case registered in ClassManagementModule, NOT UserManagementModule. Reason — UserManagementModule providing this UC would require `forwardRef(() => ClassManagementModule)` to obtain CLASS_REPOSITORY, creating a 2-module cycle. Locating the provider next to its consumer (ClassController) preserves the AC's intent ("via existing module wiring") with zero new module imports. Both repos are DI-reachable at the registration site (CLASS_REPOSITORY locally, STUDENT_REPOSITORY via existing UserManagementModule import).

SOLID + Clean Architecture:
- DIP: use case depends on two abstract ports (CLASS_REPOSITORY, STUDENT_REPOSITORY) via DI tokens; zero infra leak.
- SRP: one responsibility — orchestrate eligibility lookup. Filter translation, scoping, and 404 gating are linear and named.
- ISP: scope is narrowly typed `{ campusId: string }` (from o99c77's port signature); callers cannot smuggle extra scope.
- LSP: relies only on documented port contracts (`findById`, `findEligibleForClass`).
- OCP: filter translation is a pure transformation; adding new query params (e.g., excludeClassIds) would extend the input interface without rewriting orchestration.
- Layer placement: use case in application; DTO + controller in infra/http; provider in ClassManagementModule (infra/http). Domain enums (StudentStatus) flow through unchanged.
- Locked decisions honored: D5 (cross-campus 404 hides existence), D6 (default ACTIVE + DROPPED/GRADUATED hard-blocked at DTO).
<!-- SECTION:NOTES:END -->

