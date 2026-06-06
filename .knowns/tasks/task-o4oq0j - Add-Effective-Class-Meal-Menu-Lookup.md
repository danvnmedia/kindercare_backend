---
id: o4oq0j
title: Add Effective Class Meal Menu Lookup
status: done
priority: medium
labels:
  - from-spec
  - meal-menu
createdAt: '2026-06-03T16:07:21.923Z'
updatedAt: '2026-06-03T18:48:45.248Z'
timeSpent: 4208
assignee: '@me'
spec: specs/meal-menu-class-targeting
fulfills:
  - AC-12
  - AC-13
  - AC-14
  - AC-15
  - AC-16
order: 4
---
# Add Effective Class Meal Menu Lookup

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a separate class/week lookup that resolves class -> grade -> campus and returns menu: null when no applicable menu exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add effective class/week lookup endpoint and use case
- [x] #2 Validate lookup class belongs to the active campus
- [x] #3 Resolve class-specific menu first, then grade menu, then campus menu
- [x] #4 Return resolved target type when a menu is found
- [x] #5 Return 200 with menu: null for valid no-match lookups
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add `GetEffectiveClassMealMenuUseCase` in `src/application/meal-menu/use-cases/menu/get-effective-class-meal-menu.use-case.ts` and export it from the meal-menu application barrels. The input is `campusId`, `classId`, and `weekStartDate`; the output is `{ resolvedTargetType: MealMenuTargetType | null; menu: MealMenu | null }`. Keep validation in the application layer per @doc/architecture/clean-architecture-overview and @doc/guides/working-with-campuses.
2. In the new use case, validate that the class exists and belongs to the active campus through `ClassRepository`; missing or cross-campus class throws `NotFoundException`. Validate the requested week date as the same Monday week anchor expected by meal-menu natural keys.
3. Implement fallback with the existing `MealMenuRepository.findActiveByNaturalKey` contract from @task-msrrs2: first exact class key `{ targetType: "class", classId, gradeLevelId: null }`, then exact grade key using `classroom.gradeLevelId`, then exact campus key `{ targetType: "campus", gradeLevelId: null, classId: null }`. Return the first match with its resolved target type, or `{ resolvedTargetType: null, menu: null }` when none exists. Do not change exact list filtering from @task-arc4ge.
4. Add HTTP DTOs for the lookup query/response under `src/infra/http/dtos/meal-menu/`: required `classId` UUID and `weekStartDate` date query, plus a response containing nullable `resolvedTargetType` and nullable nested `MealMenuResponse` so valid no-match lookups serialize as `menu: null`.
5. Wire the endpoint in `src/infra/http/controllers/meal-menu.controller.ts` as a static `GET /meal-menus/effective` route placed before `GET /meal-menus/:id`, using `@CampusContext()`, campus access guard, `meal_menu.read`, Swagger docs, and `StandardResponse`. Register the new use case in `src/infra/http/modules/meal-menu.module.ts`.
6. Add focused tests in `src/application/meal-menu/use-cases/menu/meal-menu.use-case.spec.ts` and `src/infra/http/controllers/meal-menu.controller.spec.ts` for class override, grade fallback, campus fallback, `menu: null`, missing/cross-campus class 404 behavior, natural-key call order, controller query mapping, and response DTO serialization.
7. Validate with focused meal-menu Jest specs, `npm run build`, and Knowns validation for @task-o4oq0j.

Scope boundary: this task completes AC-12 through AC-16 only. Persistence, write validation, and exact list filtering are already handled by @task-msrrs2, @task-3vyo7a, and @task-arc4ge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented effective class/week meal-menu lookup: added application use case with class campus validation, class -> grade -> campus active natural-key fallback, static GET /meal-menus/effective route, query/response DTOs, module wiring, and focused tests for fallback, 404, and menu:null behavior. Verification so far: focused meal-menu Jest, broader meal-menu regression, npm run build.
Final verification passed: focused meal-menu Jest (3 suites/62 tests), broader meal-menu regression (6 suites/90 tests), npm run build, Knowns task validation, and SDD validation.
<!-- SECTION:NOTES:END -->

