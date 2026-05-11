---
id: jvdbpl
title: Repository port + Prisma impl + EnrollmentResponse shape
status: done
priority: high
labels:
  - from-spec
  - infrastructure
  - repository
createdAt: '2026-05-05T23:33:04.298Z'
updatedAt: '2026-05-06T02:36:17.838Z'
timeSpent: 869
assignee: '@me'
spec: specs/class-enrollment-period-model
fulfills:
  - AC-26
---
# Repository port + Prisma impl + EnrollmentResponse shape

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update `EnrollmentRepository` port in `src/application/class-management/ports/enrollment.repository.ts`: add `findActiveByStudentId(studentId)`, `findActiveByClassId(classId)` (or `activeOnly` param on `findByClassId`), `findHistoricalByClassId(classId)`, `findAllByStudentId(studentId)`. Remove `delete` and `deleteByStudentAndClass`. Update `PrismaEnrollmentRepository` to filter `endDate: null` by default in existing class queries and implement new methods. Update Prisma → domain mapper and `EnrollmentResponse` DTO to include `endDate` and `exitReason` (additive only, no breaking changes).

Spec: @doc/specs/class-enrollment-period-model
Covers: FR-16, NFR-8
Blocked by: Task 2 (domain entity)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `EnrollmentRepository` port adds `findActiveByStudentId`, `findActiveByClassId` (or `activeOnly` param on `findByClassId`), `findHistoricalByClassId`, `findAllByStudentId`
- [x] #2 `delete` and `deleteByStudentAndClass` removed from port and implementation (no callers remain)
- [x] #3 `PrismaEnrollmentRepository` filters `endDate: null` by default in active-only queries
- [x] #4 Prisma → domain mapper hydrates `endDate` and `exitReason` (with null-safe handling)
- [x] #5 `EnrollmentResponse` DTO includes `endDate: Date | null` and `exitReason: ExitReason | null` (additive, non-breaking)
- [x] #6 Repository unit tests cover the new query methods and active-only filtering
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Plan locked: co-locate removal of delete()/deleteByStudentAndClass() with removal of UnenrollStudentUseCase (its sole consumer) and the DELETE HTTP route. Honors AC #2 verbatim and keeps the build green between merges. q0oqvy then becomes purely additive (WithdrawStudentUseCase + POST .../withdraw).

Refs: @doc/specs/class-enrollment-period-model section "Repository changes" and "HTTP wiring".

Steps:

1. EnrollmentResponse DTO — additive fields (covers AC #5)
   File: src/infra/http/dtos/class-management/enrollment.response.ts
   - Add `endDate: Date | null` and `exitReason: ExitReason | null` with `@Expose()` and `@ApiProperty({ nullable: true })`.
   - Import `ExitReason` from domain enum index.

2. PrismaEnrollmentMapper — round-trip endDate/exitReason (covers AC #4)
   File: src/infra/persistence/prisma/mapper/prisma-enrollment.mapper.ts
   - Hydrate `endDate` and `exitReason` (cast Prisma string to `ExitReason | null`) in both `toDomain` and `toDomainSimple`.
   - Add `endDate` and `exitReason` to `toPrisma` (UncheckedCreateInput).
   - Update `toPrismaUpdate` to include `endDate` and `exitReason`; per project memory and @doc/guides/code-generation-pattern, return type stays as the existing one (no FK relations involved here, so plain `Prisma.EnrollmentUpdateInput` is correct).

3. EnrollmentRepository port — extend + remove (covers AC #1, AC #2)
   File: src/application/class-management/ports/enrollment.repository.ts
   - Add abstract methods: `findActiveByStudentId(studentId): Promise<Enrollment | null>`, `findActiveByClassId(classId): Promise<Enrollment[]>`, `findHistoricalByClassId(classId): Promise<Enrollment[]>`, `findAllByStudentId(studentId): Promise<Enrollment[]>`.
   - Remove `delete(id)` and `deleteByStudentAndClass(studentId, classId)`.
   - Keep existing `findByClassId`/`findByStudentId`/`findByStudentClassDate` unchanged for now (callers retire in ncjacr/zffh6i).

4. PrismaEnrollmentRepository — implement new methods (covers AC #3)
   File: src/infra/persistence/prisma/repositories/prisma-enrollment.repository.ts
   - `findActiveByStudentId`: `findFirst({ where: { studentId, endDate: null }, include: { class, student } })`.
   - `findActiveByClassId`: `findMany({ where: { classId, endDate: null }, include, orderBy enrollmentDate desc })`.
   - `findHistoricalByClassId`: `findMany({ where: { classId }, include, orderBy enrollmentDate desc })` — all rows, no endDate filter.
   - `findAllByStudentId`: `findMany({ where: { studentId }, include: { class: { include: { schoolYear, gradeLevel } }, student }, orderBy enrollmentDate desc })` — rich relations needed for AC-25 student history view.
   - Drop `delete()` and `deleteByStudentAndClass()` implementations.

5. Drop UnenrollStudentUseCase + DELETE route + DI registration (sole consumers of removed port methods)
   - Delete src/application/class-management/use-cases/enrollment/unenroll-student.use-case.ts.
   - Remove `export * from "./unenroll-student.use-case"` from enrollment index.ts.
   - Remove DELETE :classId/enrollments/:enrollmentId route from class.controller.ts; drop its constructor injection and import.
   - Remove UnenrollStudentUseCase provider from class-management.module.ts.

6. Update existing mock repositories so the build stays green
   - enroll-student.use-case.spec.ts and cross-campus-prevention.integration.spec.ts: drop `delete`/`deleteByStudentAndClass` from EnrollmentRepository mocks, add the four new method mocks alongside.

7. Add repository unit tests — new file (covers AC #6)
   File: src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts
   - Mock PrismaService + PrismaQueryService.
   - Verify: findActiveByStudentId issues `where.endDate=null` and uses findFirst; findActiveByClassId issues `where.endDate=null` + `orderBy enrollmentDate desc`; findHistoricalByClassId issues NO endDate filter; findAllByStudentId issues no endDate filter AND includes nested schoolYear/gradeLevel; null vs entity return paths.

8. Verify
   - `npx jest src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts src/application/class-management/use-cases/enrollment src/domain/class-management` (new + regression).
   - `npx tsc --noEmit`.
   - `mcp_knowns_validate({ entity: "jvdbpl" })`.

Notes:
- No backwards-compat shim for the removed DELETE endpoint — the spec explicitly drops it; the new POST .../withdraw lands in q0oqvy.
- `findByClassId`/`findByStudentId` are retained unchanged here; their callers swap to active-only variants in ncjacr.
- `findByStudentClassDate` is retained; zffh6i may retire it when EnrollStudentUseCase switches to "active in any class" duplicate detection via findActiveByStudentId.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete (option A: co-located removal of UnenrollStudentUseCase + DELETE route).

Files touched:
- src/infra/http/dtos/class-management/enrollment.response.ts — added `endDate: Date | null` and `exitReason: ExitReason | null` with @ApiProperty(nullable, enum metadata).
- src/infra/persistence/prisma/mapper/prisma-enrollment.mapper.ts — `toDomain`/`toDomainSimple` hydrate `endDate`/`exitReason`; `toPrisma` and `toPrismaUpdate` round-trip both fields. Added private `toExitReason()` helper that null-safely coerces unknown DB values to null instead of throwing — validation lives at wire/domain layers.
- src/application/class-management/ports/enrollment.repository.ts — added `findActiveByStudentId` (returns single or null), `findActiveByClassId`, `findHistoricalByClassId`, `findAllByStudentId`. Removed `delete` and `deleteByStudentAndClass`.
- src/infra/persistence/prisma/repositories/prisma-enrollment.repository.ts — implemented the four new methods. Active-only methods filter `endDate: null`. `findHistoricalByClassId` returns all rows. `findAllByStudentId` includes nested `schoolYear`/`gradeLevel` (needed for the AC-25 history view that ships in @task-ncjacr).
- src/application/class-management/use-cases/enrollment/unenroll-student.use-case.ts — DELETED (replaced by WithdrawStudentUseCase in @task-q0oqvy).
- src/application/class-management/use-cases/enrollment/index.ts — dropped the unenroll re-export.
- src/infra/http/controllers/class-management/class.controller.ts — removed the DELETE :classId/enrollments/:enrollmentId route, its constructor injection, and the import.
- src/infra/http/modules/class-management.module.ts — dropped UnenrollStudentUseCase import and provider.
- src/application/class-management/use-cases/enrollment/enroll-student.use-case.spec.ts — mock repo updated (removed delete/deleteByStudentAndClass, added 4 new method mocks).
- src/application/class-management/use-cases/cross-campus-prevention.integration.spec.ts — same mock update applied to both setups.
- src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts — NEW: 9 tests covering active-only filtering, historical (no filter), all-by-student (with nested includes), null returns, and mapper round-trip of exitReason as enum.

Verification:
- `npx jest src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts` → 9/9 passed (new spec).
- `npx jest src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts src/application/class-management src/domain/class-management` → 101/101 passed across 11 suites (full regression in touched areas, no failures).
- `npx tsc --noEmit` → clean (exit 0).
- Knowns validation → 0/0/0.

SOLID & Clean Architecture compliance:
- DIP: port stays in application layer with no Prisma/Nest types; impl in infra layer implements abstract class via Nest @Injectable.
- ISP: split into four narrowly-named methods (findActive*, findHistorical*, findAllByStudentId) instead of one overloaded method with a flag — callers express intent at the call site.
- OCP: existing findByClassId/findByStudentId/findByStudentClassDate kept unchanged; their callers retire in @task-ncjacr / @task-zffh6i without breaking other consumers.
- SRP: mapper's `toExitReason` private helper isolates the string→enum coercion so the toDomain methods stay declarative. DTO additive only — no shape regression.
- LSP: PrismaEnrollmentRepository fully implements EnrollmentRepository; mock repos updated to match the new contract so jest.Mocked typing stays correct.

Backwards compatibility: the DELETE :classId/enrollments/:enrollmentId HTTP route is removed in this task per the spec (FR-12). Its replacement POST .../withdraw lands in @task-q0oqvy on the same branch — no API gap will reach prod. No clients consume the legacy route in this repo.
<!-- SECTION:NOTES:END -->

