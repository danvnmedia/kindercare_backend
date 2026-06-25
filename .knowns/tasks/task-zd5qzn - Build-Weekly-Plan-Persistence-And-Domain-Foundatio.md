---
id: zd5qzn
title: Build Weekly Plan Persistence And Domain Foundation
status: done
priority: medium
labels:
  - from-spec
  - weekly-plan
  - foundation
createdAt: '2026-06-18T12:25:56.444Z'
updatedAt: '2026-06-18T12:46:18.670Z'
timeSpent: 536
assignee: '@me'
spec: specs/weekly-plan-daily-schedule
order: 1
---
# Build Weekly Plan Persistence And Domain Foundation

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the new Weekly Plan vertical slice foundation for @doc/specs/weekly-plan-daily-schedule: Prisma models/migration, active-only partial unique index, domain entity/value handling, repository and transaction operations for parent/block/activity rows. Follow supporting context in @doc/research/weekly-plan-daily-schedule-backend-research.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add `WeeklyPlan`, `WeeklyPlanBlock`, and `WeeklyPlanActivity` persistence with cascade child behavior.
- [x] #2 Add active-only uniqueness on `(campusId, classId, weekStartDate)`.
- [x] #3 Add shared normalization/validation helpers for Monday weeks, `HH:mm` times, theme, activities, ordering, and overlap checks.
- [x] #4 Add repository and transaction operation support following existing Meal Menu/UoW patterns.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add Prisma schema and migration for `WeeklyPlan`, `WeeklyPlanBlock`, and `WeeklyPlanActivity`, including class/campus relations, child cascade behavior, indexes, and active-only partial unique index per @doc/patterns/prisma-migration-patterns and @doc/research/weekly-plan-daily-schedule-backend-research.
2. Add `src/domain/weekly-plan` entity/model helpers for Monday `weekStartDate`, `HH:mm` <-> minute normalization, theme/activity trimming, block ordering, and same-day overlap validation, following @doc/patterns/entity-pattern and Meal Menu grid conventions.
3. Add `WeeklyPlanRepository` application port plus Prisma mapper/repository methods for save, update, archive, restore, find by campus/id, list support, and active natural-key lookup.
4. Add Weekly Plan transaction operations and wire them into `TransactionContext`/`PrismaUnitOfWork` per @doc/patterns/unit-of-work-pattern so later use cases can mutate plan rows and child rows inside one transaction.
5. Run Prisma validation/generation or focused build checks, validate the task, then check ACs only after the foundation is fully wired.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Weekly Plan foundation: Prisma schema/migration, domain entity and schedule helpers, repository/mapper, UoW transaction ops, exports, and focused schedule tests. Verification: `npx prisma validate`, `npx prisma generate --no-engine`, `npx jest domain/weekly-plan/weekly-plan-schedule.spec.ts --runInBand`, `npm run build`.
<!-- SECTION:NOTES:END -->

