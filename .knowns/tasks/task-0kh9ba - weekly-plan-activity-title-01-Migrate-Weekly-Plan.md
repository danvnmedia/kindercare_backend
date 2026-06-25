---
id: 0kh9ba
title: weekly-plan-activity-title-01 Migrate Weekly Plan Activity Persistence And Domain Model
status: done
priority: medium
labels:
  - from-spec
  - weekly-plan
  - activity-title
  - persistence
createdAt: '2026-06-24T13:31:51.521Z'
updatedAt: '2026-06-24T13:41:02.681Z'
timeSpent: 372
assignee: '@me'
spec: specs/weekly-plan-activity-title-and-description
fulfills:
  - AC-7
order: 1
---
# weekly-plan-activity-title-01 Migrate Weekly Plan Activity Persistence And Domain Model

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the Weekly Plan activity persistence and domain foundation for @doc/specs/weekly-plan-activity-title-and-description. Replace the current single `text` activity model with required `title` plus nullable `description`, including data migration/backfill from existing `text` values.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add Prisma schema and migration changes so existing `weekly_plan_activity.text` values become `title` and `description` is nullable.
- [x] #2 Update Weekly Plan domain activity input/output types and normalization to use required trimmed `title` and nullable trimmed `description`.
- [x] #3 Update Prisma Weekly Plan mapper/repository persistence paths to load and save `title` plus `description`.
- [x] #4 Add focused tests or migration verification for backfill and domain normalization behavior.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update `prisma/schema.prisma` and add a migration after `20260618124000_add_weekly_plan_foundation` that renames/backfills `weekly_plan_activity.text` into required `title`, adds nullable `description`, preserves existing activity content, and keeps order constraints/indexes intact.
2. Update `src/domain/weekly-plan/weekly-plan-schedule.ts` activity types and normalization so activities use required trimmed `title`, nullable trimmed `description`, title max 500, description max 2000, and existing ordering behavior remains unchanged.
3. Update `src/infra/persistence/prisma/mapper/prisma-weekly-plan.mapper.ts` so Prisma rows load/save `title` and `description` instead of `text` while preserving block/activity ordering.
4. Add focused coverage in `src/domain/weekly-plan/weekly-plan-schedule.spec.ts` for title/description normalization, blank/overlength validation, null/blank description normalization, and order preservation.
5. Verify with focused weekly-plan domain tests plus Prisma validation/generation and task validation before checking ACs and stopping the timer.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented persistence/domain foundation for activity title/description: schema now has `title` and nullable `description`, migration renames/backfills existing `text` into `title`, domain normalization returns `{ order, title, description }`, mapper loads/saves the new fields, and focused domain tests cover normalization/rejection cases. Verification: `npx jest domain/weekly-plan/weekly-plan-schedule.spec.ts --runInBand`, `npx prisma validate`, `npx prisma generate --no-engine`. `npm run build` was attempted but hit the 120s timeout; rerun with broader API verification after task dezwyv updates DTO/callers.
kn-review: PASS for task scope. Checked migration, domain normalization, mapper persistence, focused tests, and spec AC-7 wiring. No P1/P2/P3 findings in the persistence/domain diff. Verification gap intentionally carried to dependent task dezwyv: broad `npm run build` timed out before API DTO/caller updates and must be rerun after the API contract task.
<!-- SECTION:NOTES:END -->

