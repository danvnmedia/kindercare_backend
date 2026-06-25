---
id: 8bx4s2
title: Implement Weekly Plan Update And Schedule Validation Behavior
status: done
priority: medium
labels:
  - from-spec
  - weekly-plan
  - validation
createdAt: '2026-06-18T12:26:15.785Z'
updatedAt: '2026-06-18T12:58:58.239Z'
timeSpent: 171
assignee: '@me'
spec: specs/weekly-plan-daily-schedule
fulfills:
  - AC-8
  - AC-11
  - AC-12
  - AC-13
  - AC-14
  - AC-15
order: 3
---
# Implement Weekly Plan Update And Schedule Validation Behavior

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `PATCH /weekly-plans/:id` for @doc/specs/weekly-plan-daily-schedule with full schedule replacement and consistent week/date/block/activity validation across create, update, and active lookup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reject non-Monday week anchors on applicable flows.
- [x] #2 Reject malformed times, invalid ordering, missing/blank/overlength activities, and overlapping blocks.
- [x] #3 Allow adjacent blocks and days `1..7`.
- [x] #4 Preserve multiple activity order and return normalized sorted blocks.
- [x] #5 Replace stored schedule atomically on update.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `UpdateWeeklyPlanUseCase` that loads one active-campus plan, rejects archived mutation, optionally validates a new class/week/theme, checks active natural-key conflicts excluding the current plan, applies full `blocks[]` replacement through the domain entity, and persists through `tx.updateWeeklyPlan`.
2. Add `UpdateWeeklyPlanRequest` DTO and wire `PATCH /weekly-plans/:id` in `WeeklyPlanController`, reusing existing `WeeklyPlanResponse` and `WeeklyPlanBlockRequest` shapes.
3. Extend Weekly Plan tests to cover update schedule replacement, non-Monday rejection, overlap rejection/adjacent acceptance via existing helpers, and archived mutation rejection.
4. Run focused weekly-plan tests, Prisma validation/generation as needed, build, Knowns validation, then check ACs only after update wiring is verified.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Weekly Plan update behavior: `UpdateWeeklyPlanUseCase`, `PATCH /weekly-plans/:id`, update DTO, module/provider wiring, and tests for schedule replacement, non-Monday rejection, and archived mutation rejection. Verification: `npx jest application/weekly-plan/use-cases/weekly-plan.use-case.spec.ts domain/weekly-plan/weekly-plan-schedule.spec.ts --runInBand`, `npm run build`.
kn-review completed: inspected update use case, controller/DTO/module wiring, domain normalization, repository/UoW update semantics, diagnostics, focused tests, and build results. No P1/P2/P3 findings; permissions/audit intentionally remain for task dbrsl2.
<!-- SECTION:NOTES:END -->

