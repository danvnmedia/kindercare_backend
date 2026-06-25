---
id: g1yade
title: Implement Weekly Plan Copy, Archive, Restore, And Conflict Semantics
status: done
priority: medium
labels:
  - from-spec
  - weekly-plan
  - lifecycle
createdAt: '2026-06-18T12:26:24.911Z'
updatedAt: '2026-06-18T13:04:39.024Z'
timeSpent: 273
assignee: '@me'
spec: specs/weekly-plan-daily-schedule
fulfills:
  - AC-4
  - AC-5
  - AC-6
  - AC-7
  - AC-9
  - AC-16
  - AC-17
  - AC-21
order: 4
---
# Implement Weekly Plan Copy, Archive, Restore, And Conflict Semantics

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add whole-week copy, soft archive, restore, per-class skipped reasons, archived-state guards, and duplicate protection across create/copy/restore for @doc/specs/weekly-plan-daily-schedule.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Implement `POST /weekly-plans/:id/copy`, `DELETE /weekly-plans/:id`, and `PATCH /weekly-plans/:id/restore`.
- [x] #2 Preserve source schedule and default theme on copy, with override/clear support.
- [x] #3 Return stable skipped reasons for active-plan conflicts and invalid destination classes in batch flows.
- [x] #4 Allow archived records to stop blocking creates, but block restore on active conflicts.
- [x] #5 Handle concurrent duplicate attempts without producing two active records.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add lifecycle use cases for `copy`, `archive`, and `restore`: campus-scoped source lookup, archived-state guards, Monday/theme normalization for copy, stable per-class `skipped[]` entries for invalid destination classes and active conflicts, active-only conflict checks, and P2002 duplicate handling around UoW writes. Copy will preserve source `blocks[]` and source theme by default, with explicit override or clear support.
2. Add HTTP request/response DTOs for copy and wire `POST /weekly-plans/:id/copy`, `DELETE /weekly-plans/:id`, and `PATCH /weekly-plans/:id/restore` into `WeeklyPlanController`, keeping campus context from headers only and reusing `WeeklyPlanResponse`.
3. Register the new use cases in `WeeklyPlanModule` and export them through the weekly-plan application barrel.
4. Extend focused weekly-plan use-case tests for copy success with theme override, per-class conflict/missing skips, archived source copy rejection, archive non-blocking semantics, restore conflict, and unique-constraint duplicate handling.
5. Verify with focused Jest, build, Prisma validation/generation as needed, Knowns validation, then check ACs only after routes, lifecycle semantics, and concurrency guard behavior are verified.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Weekly Plan lifecycle behavior: `CopyWeeklyPlanUseCase`, `ArchiveWeeklyPlanUseCase`, `RestoreWeeklyPlanUseCase`, copy request/response DTOs, controller routes for `POST /weekly-plans/:id/copy`, `DELETE /weekly-plans/:id`, and `PATCH /weekly-plans/:id/restore`, module/provider exports, and focused lifecycle tests. Copy preserves source blocks/activities, preserves source theme by default, supports override/clear, returns stable skipped reasons for missing/cross-campus destination classes and active conflicts, rejects archived source copy, archive is soft only, restore blocks active conflicts, and P2002 duplicate races are handled for copy/restore. Verification: `npx jest application/weekly-plan/use-cases/weekly-plan.use-case.spec.ts domain/weekly-plan/weekly-plan-schedule.spec.ts --runInBand`, `npx prisma validate`, `npx prisma generate --no-engine`, `npm run build`.
kn-review completed: inspected lifecycle use cases, controller route wiring, copy DTO/response shape, UoW write usage, and focused test coverage. Found and fixed one P2 issue where copy theme normalization could throw a plain domain Error instead of BadRequestException; added regression coverage. Verification after fix: focused weekly-plan/domain Jest and `npm run build` passed. No remaining P1/P2/P3 findings.
<!-- SECTION:NOTES:END -->

