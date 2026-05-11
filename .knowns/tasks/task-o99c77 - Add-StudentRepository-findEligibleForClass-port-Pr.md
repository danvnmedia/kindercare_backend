---
id: o99c77
title: Add StudentRepository.findEligibleForClass port + Prisma impl
status: done
priority: medium
labels:
  - from-spec
  - backend
  - user-management
  - class-management
  - bulk-enrollment
  - foundation
  - repository
createdAt: '2026-05-10T19:42:05.928Z'
updatedAt: '2026-05-10T21:35:56.316Z'
timeSpent: 881
assignee: '@me'
spec: specs/bulk-enrollment
fulfills:
  - AC-21
---
# Add StudentRepository.findEligibleForClass port + Prisma impl

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend `StudentRepository` port (`src/application/user-management/ports/student.repository.ts`) with `findEligibleForClass(classId: string, params: StandardRequest, scope?: { campusId: string }): Promise<PaginatedResult<Student>>`. Prisma impl applies `enrollments: { none: { endDate: null } }` (NOT EXISTS predicate) plus `isArchived: false`, `status: { in: includeStatuses }`, and `scope.campusId` enforced via PrismaQueryService scope. Routed through `PrismaQueryService.executeQuery` so pagination, sort, and search continue to work via the existing infrastructure. Foundation for Eligible Students task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Abstract `findEligibleForClass(classId, params, scope?)` added to StudentRepository port with PaginatedResult<Student> return
- [x] #2 Prisma impl uses relation filter `enrollments: { none: { endDate: null } }`
- [x] #3 Filters: isArchived=false, status: { in: includeStatuses }, scope.campusId enforced
- [x] #4 Allowed sort fields registered: fullName, studentCode, dateOfBirth, createdAt
- [x] #5 Routed through PrismaQueryService.executeQuery so search/pagination/sort work
- [x] #6 Spec test: active-elsewhere students excluded
- [x] #7 Spec test: archived students excluded
- [x] #8 Spec test: status filter respects includeStatuses input
- [x] #9 Spec test: cross-campus students excluded via scope
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend `StudentRepository` port (src/application/user-management/ports/student.repository.ts) with abstract `findEligibleForClass(classId: string, params: StandardRequest, scope?: { campusId: string }): Promise<PaginatedResult<Student>>` plus docstring explaining the contract (NOT EXISTS active-enrollment, isArchived=false, status filter respected, scope.campusId enforced).

2. Implement in `PrismaStudentRepository` (src/infra/persistence/prisma/repositories/prisma-student.repository.ts) via PrismaQueryService.executeQuery:
   - `where: { isArchived: false, enrollments: { none: { endDate: null } } }` — system base, not user-overridable (not in allowedFilterFields)
   - `scope: { campusId: scope.campusId }` (only when provided) — applied LAST per @doc/specs/bulk-enrollment#repository-changes and project memory `feedback_campus_scoped_list_pattern`
   - `params.allowedFilterFields = ["fullName", "studentCode", "status"]` — minimal surface so controller can translate `?search=...` → ilike(fullName) and `?includeStatuses=...` → status.in (AC-9..AC-11)
   - `params.allowedSortFields = ["fullName", "studentCode", "dateOfBirth", "createdAt"]` (AC #4)
   - default `orderBy: { createdAt: "desc" }`
   - `include: { guardians: { include: { guardian: true, guardianRelationship: true } } }` mirroring existing `findAll` so StudentResponse shape lines up for the next task

3. Add `findEligibleForClass: jest.fn()` to canonical `createMockStudentRepository()` in src/test-utils/mock-repository-factory.ts.

4. Patch inline `mockStudentRepository = { ... }` builders (last line `getStudentGuardians: jest.fn(),`) in 6 spec files so they keep typechecking against the now-extended port:
   - src/application/class-management/use-cases/enrollment/enroll-student.use-case.spec.ts
   - src/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case.spec.ts
   - src/application/class-management/use-cases/cross-campus-prevention.integration.spec.ts (2 occurrences)
   - src/application/user-management/use-cases/student/restore-student.use-case.spec.ts
   - src/application/user-management/use-cases/student/archive-student.use-case.spec.ts
   - src/application/user-management/use-cases/student/update-student-guardian-relationship.use-case.spec.ts

5. Create new repo unit-test spec src/infra/persistence/prisma/repositories/prisma-student.repository.spec.ts (mirroring prisma-enrollment.repository.spec.ts style — mocked `PrismaQueryService.executeQuery`, assert call args). Four tests covering each AC #6–#9:
   a. active-elsewhere excluded → assert `enrollments: { none: { endDate: null } }` is in `where` arg
   b. archived excluded → assert `isArchived: false` in `where`
   c. status filter respected → pass StandardRequest with `filter='{"status":{"in":["ACTIVE","WAITING"]}}'`, assert `status` is in `allowedFilterFields` so it survives into executeQuery
   d. cross-campus excluded → pass `scope: { campusId: "campus-1" }`, assert it lands on `scope` arg of executeQuery

6. Verify: `npm run build` (0 errors), `npx jest <new prisma-student.repository.spec.ts>` (4/4 pass), `npx jest src/application/user-management src/application/class-management/use-cases/enrollment src/application/class-management/use-cases/cross-campus-prevention.integration.spec.ts src/application/campus/use-cases/campus-isolation.integration.spec.ts` for regression, `mcp__knowns__validate({ entity: "o99c77" })` (0/0).

Patterns referenced:
- @doc/specs/bulk-enrollment#repository-changes (relation-filter contract)
- @doc/specs/bulk-enrollment#domain---shared (AC-21)
- existing `PrismaStudentRepository.findAll` (executeQuery wiring)
- existing `prisma-enrollment.repository.spec.ts` (test scaffolding)
- project memory `feedback_campus_scoped_list_pattern` (campusId via scope, not allowedFilterFields)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete (2026-05-10).

Files changed (10):
- src/application/user-management/ports/student.repository.ts — added abstract `findEligibleForClass(classId, params, scope?: { campusId })` with docstring covering the contract (NOT EXISTS, isArchived=false, status filter respected, campus enforcement).
- src/infra/persistence/prisma/repositories/prisma-student.repository.ts — Prisma impl routed through PrismaQueryService.executeQuery. system `where: { isArchived: false, enrollments: { none: { endDate: null } } }`. `params.allowedFilterFields = ["fullName","studentCode","status"]`, `params.allowedSortFields = ["fullName","studentCode","dateOfBirth","createdAt"]`. Default order `createdAt desc`. `include` matches existing `findAll` so StudentResponse shape stays consistent. `_classId` reserved per port contract.
- src/test-utils/mock-repository-factory.ts — `findEligibleForClass: jest.fn()` added to canonical `createMockStudentRepository`.
- 5 inline-mock spec files patched (1 site each): archive-student, restore-student, update-student-guardian-relationship, enroll-student, bulk-enroll-students.
- 1 inline-mock spec file patched at 2 sites (replace_all): cross-campus-prevention.integration.
- NEW src/infra/persistence/prisma/repositories/prisma-student.repository.spec.ts — 5 tests covering ACs #6–#9 (active-elsewhere excluded, archived excluded, status filter passes through, scope enforces campus) plus a routing test verifying model="student" + PrismaStudentMapper + allowedSortFields + include.

Verification:
- `npm run build` → 0 errors
- `npx jest <new prisma-student.repository.spec.ts>` → 5/5 pass
- Regression sweep across user-management/student + class-management/use-cases/enrollment + cross-campus-prevention.integration + campus-isolation.integration + prisma repository specs → 13 suites / 118 tests pass.

SOLID/Clean Architecture:
- DIP: port lives in application layer, untouched by infra concerns.
- ISP: signature narrowed via `scope?: { campusId: string }` (not Record<string, any>) — callers cannot smuggle extra scope.
- SRP: repo method does one thing — produce a paginated, scoped, eligibility-filtered student list.
- OCP/last-wins: system enforcement lives in `where` + `scope`; user-controllable surface is the deliberate, narrow `allowedFilterFields` set. Future changes to user filters do not touch the system invariants.
<!-- SECTION:NOTES:END -->

