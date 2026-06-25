---
id: rempte
title: Implement Weekly Plan Create, Read, List, And Active Lookup APIs
status: done
priority: medium
labels:
  - from-spec
  - weekly-plan
  - api
createdAt: '2026-06-18T12:26:06.602Z'
updatedAt: '2026-06-18T12:53:38.793Z'
timeSpent: 320
assignee: '@me'
spec: specs/weekly-plan-daily-schedule
fulfills:
  - AC-1
  - AC-2
  - AC-3
  - AC-10
  - AC-18
order: 2
---
# Implement Weekly Plan Create, Read, List, And Active Lookup APIs

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the `weekly-plans` module/controller/use cases for `POST /weekly-plans`, `GET /weekly-plans`, `GET /weekly-plans/:id`, and `GET /weekly-plans/active` for @doc/specs/weekly-plan-daily-schedule, including batch create and class context responses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create independent plans for one or more classes.
- [x] #2 Return normalized flat `blocks[]`, class context, theme, archive state, and timestamps.
- [x] #3 Support active lookup with `plan: null` for valid empty class/week.
- [x] #4 Support standard pagination, sorting, and allowed filters with archived excluded by default.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Weekly Plan application use cases for create, list, get-by-id, and active lookup using `WeeklyPlanRepository`, `ClassRepository`, and the UoW foundation from @task-zd5qzn; validate active-campus class ownership and Monday weeks per @doc/specs/weekly-plan-daily-schedule.
2. Add request/response DTOs for `classIds`, `weekStartDate`, nullable `theme`, flat `blocks[]` with `HH:mm` `startTime`/`endTime`, ordered `activities[]`, list query, and active lookup response.
3. Add `WeeklyPlanController` and `WeeklyPlanModule` routes for `POST /weekly-plans`, `GET /weekly-plans`, `GET /weekly-plans/:id`, and `GET /weekly-plans/active`, following Meal Menu StandardResponse/campus-context conventions while leaving permission/audit additions to @task-dbrsl2.
4. Wire module providers for `WEEKLY_PLAN_REPOSITORY` and existing `CLASS_REPOSITORY`, register the module in the HTTP/app module path, and export use-case/index files.
5. Add focused use-case or DTO/domain tests for batch create independence and active lookup empty-state behavior; run focused tests, Prisma validation/generation, build, Knowns validation, then check ACs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Weekly Plan create/read/list/active lookup API surface: application use cases, DTOs, controller routes, module registration, repository/provider wiring, and focused use-case tests. Verification: `npx jest application/weekly-plan/use-cases/weekly-plan.use-case.spec.ts --runInBand`, `npx prisma validate`, `npx prisma generate --no-engine`, `npm run build`.
Review fix: moved week/theme/block normalization ahead of per-class skip handling so malformed request-level schedule payloads always return validation errors even when all class destinations would be skipped. Added regression test and reran `npx jest application/weekly-plan/use-cases/weekly-plan.use-case.spec.ts --runInBand` and `npm run build`.
<!-- SECTION:NOTES:END -->

