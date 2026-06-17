---
id: msrrs2
title: Migrate Meal Menu Target Model
status: done
priority: high
labels:
  - from-spec
  - meal-menu
createdAt: '2026-06-03T16:07:21.850Z'
updatedAt: '2026-06-03T16:26:19.398Z'
timeSpent: 835
assignee: '@me'
spec: specs/meal-menu-class-targeting
fulfills:
  - AC-5
  - AC-6
  - AC-7
  - AC-8
  - AC-17
order: 1
---
# Migrate Meal Menu Target Model

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add explicit target identity for campus, grade, and class, migrate existing rows, update domain/repository/mapper behavior, and preserve archived/history data.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add persistence shape for targetType, gradeLevelId, and classId
- [x] #2 Migrate existing gradeLevelId=null rows to campus targets and non-null rows to grade targets
- [x] #3 Enforce exact active target/week uniqueness for campus, grade, and class targets
- [x] #4 Update domain, repository, mapper, and persistence tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update the MealMenu Prisma model and add a hand-written migration following @doc/patterns/prisma-migration-patterns. Add explicit `targetType`/`target_type`, nullable `classId`/`class_id`, a Class relation, lookup indexes, and a DB check constraint so campus has no ids, grade has only `gradeLevelId`, and class has only `classId`.
2. Backfill existing rows in the migration: `grade_level_id IS NULL` becomes `target_type = campus`, non-null `grade_level_id` becomes `target_type = grade`, while preserving ids, entries, archive state, dates, titles, and timestamps.
3. Replace the existing `meal_menu_active_natural_key` with active-only partial unique indexes for exact targets: campus `(campus_id, week_start_date)`, grade `(campus_id, grade_level_id, week_start_date)`, and class `(campus_id, class_id, week_start_date)`, leaving archived rows non-blocking.
4. Update the domain and application persistence contract: add a meal-menu target type/discriminated target shape to `MealMenu`, expose `targetType` and `classId`, keep target invariants in the entity, and extend `MealMenuNaturalKey`/repository options to include the explicit target identity.
5. Update Prisma mapper, repository, and unit-of-work transaction ops so `save`, `update`, `findActiveByNaturalKey`, `findAnyByNaturalKey`, restore conflict checks, and campus-scoped queries read/write the new target fields consistently with @doc/patterns/repository-pattern and @doc/guides/working-with-campuses.
6. Add focused tests for the foundation: entity target invariants, Prisma mapper target field mapping, repository natural-key lookups for campus/grade/class, coexistence of different exact targets, archived-row non-blocking behavior, and migration/schema validation.
7. Validate with `npx prisma validate`, `npx prisma generate`, `npm run build`, and focused Jest specs for `meal-menu.entity`, `prisma-meal-menu.mapper`, and `prisma-meal-menu.repository`.

Scope boundary: this task prepares schema/domain/persistence support only. API request validation remains in @task-3vyo7a, exact list response behavior remains in @task-arc4ge, and effective class fallback remains in @task-o4oq0j.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented explicit meal-menu target foundation: added targetType/classId schema and migration backfill, target identity domain invariants, target-aware natural keys in repositories/use cases, Prisma mapper/repository/UoW support, and focused domain/mapper/repository/use-case tests. Verification passed: npx prisma validate, npx prisma generate, focused Jest meal-menu specs, npm run build.
<!-- SECTION:NOTES:END -->

