---
id: arc4ge
title: Add Exact Meal Menu Target List Filtering And Response Context
status: done
priority: medium
labels:
  - from-spec
  - meal-menu
createdAt: '2026-06-03T16:07:21.913Z'
updatedAt: '2026-06-03T17:17:25.592Z'
timeSpent: 441
assignee: '@me'
spec: specs/meal-menu-class-targeting
fulfills:
  - AC-9
  - AC-10
  - AC-11
order: 3
---
# Add Exact Meal Menu Target List Filtering And Response Context

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend GET /meal-menus to exact-filter by class, grade, or campus target and expose explicit target context in responses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add target=class&classId exact list filtering
- [x] #2 Preserve explicit target=grade&gradeLevelId and target=campus exact filtering
- [x] #3 Reject invalid list target/id combinations
- [x] #4 Include target type and relevant target summaries in meal menu responses
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend the list query contract in `src/infra/http/dtos/meal-menu/list-meal-menus.query.ts` and `src/infra/http/controllers/meal-menu.controller.ts`: add `target=class`, optional `classId`, controller mapping to `GetMealMenusInput`, and Swagger/BadRequest/NotFound text while keeping campus scope from `@CampusContext()` per @doc/guides/working-with-campuses.
2. Update `src/application/meal-menu/use-cases/menu/get-meal-menus.use-case.ts` to support exact class scopes. Add `class` to `MealMenuListTarget`, include `classId` in the input, inject/use `ClassRepository`, validate campus ownership, and build exact scopes: campus `{ targetType: "campus", gradeLevelId: null, classId: null }`, grade `{ targetType: "grade", gradeLevelId, classId: null }`, class `{ targetType: "class", gradeLevelId: null, classId }`.
3. Harden list target validation in the same use case: `target=class` requires only `classId`; `target=grade` requires only `gradeLevelId`; `target=campus` and `target=all` reject both target ids; invalid target values mention all supported values. Preserve the existing exact campus/grade behavior from @task-msrrs2 and do not add fallback lookup behavior reserved for @task-o4oq0j.
4. Expose explicit target context in `src/infra/http/dtos/meal-menu/meal-menu.response.ts` following @doc/patterns/dto-pattern and @doc/patterns/standard-response-pattern. Add `targetType`, `classId`, and a nullable class summary DTO mapped from the domain `classroom` snapshot, while keeping existing `gradeLevelId` and `gradeLevel` output.
5. Expand focused tests in `src/application/meal-menu/use-cases/menu/meal-menu.use-case.spec.ts` and `src/infra/http/controllers/meal-menu.controller.spec.ts`: class exact filter success, preserved grade/campus exact filters, rejection of invalid target/id combinations, cross-campus/missing class rejection, controller query threading for `classId`, and response DTO exposure where the existing test pattern supports it.
6. Validate with focused meal-menu Jest specs, then `npm run build`. If repository query behavior is touched during implementation, also rerun `prisma-meal-menu.repository.spec.ts` to confirm scoped exact filtering still maps cleanly through Prisma.

Scope boundary: this task implements exact list filtering and response context for AC-9, AC-10, and AC-11 only. Create/update/copy validation is already handled by @task-3vyo7a; effective class fallback remains in @task-o4oq0j.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented exact list target filtering and response context: GET /meal-menus now accepts target=class with classId, validates class/grade ownership in the application use case, rejects mismatched target ids, preserves exact campus/grade scopes, and exposes targetType/classId/classroom in MealMenuResponse. Verification passed: focused meal-menu Jest specs, broader meal-menu regression specs, npm run build, and Knowns validation.
<!-- SECTION:NOTES:END -->

