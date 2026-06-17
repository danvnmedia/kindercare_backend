---
id: 3vyo7a
title: Update Meal Menu Write APIs And Target Validation
status: done
priority: high
labels:
  - from-spec
  - meal-menu
createdAt: '2026-06-03T16:07:21.863Z'
updatedAt: '2026-06-03T16:57:51.459Z'
timeSpent: 1027
assignee: '@me'
spec: specs/meal-menu-class-targeting
fulfills:
  - AC-1
  - AC-2
  - AC-3
  - AC-4
  - AC-18
order: 2
---
# Update Meal Menu Write APIs And Target Validation

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Require explicit targetType for create/update/copy and enforce exact target id rules for campus, grade, and class menus.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Update create/update/copy DTOs and controller mapping for explicit targetType
- [x] #2 Validate campus targets reject gradeLevelId and classId
- [x] #3 Validate grade targets require campus-owned gradeLevelId and reject classId
- [x] #4 Validate class targets require campus-owned classId and reject caller-supplied gradeLevelId
- [x] #5 Reject legacy or inferred target requests without targetType
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the legacy write DTO shape in `src/infra/http/dtos/meal-menu/{create,update,copy}-meal-menu.request.ts`: require `targetType` (`campus` | `grade` | `class`), add optional `classId`, keep UUID/type decorators for target ids, and update Swagger descriptions so callers no longer infer campus/grade from `gradeLevelId`. This follows @doc/patterns/dto-pattern and D4/D6 in @doc/specs/meal-menu-class-targeting.
2. Update `src/infra/http/controllers/meal-menu.controller.ts` and `meal-menu.controller.spec.ts` so create/update/copy mapping passes `targetType`, `gradeLevelId`, and `classId` into the application inputs while continuing to source `campusId` only from `@CampusContext()` per @doc/guides/working-with-campuses.
3. Update `CreateMealMenuInput`, `UpdateMealMenuInput`, and `CopyMealMenuInput` plus their use cases to require explicit target identity for write requests. Add a small application-layer target resolver/validator that rejects missing `targetType`, campus requests with any supplied target id, grade requests without campus-owned `gradeLevelId` or with `classId`, and class requests without campus-owned `classId` or with caller-supplied `gradeLevelId`.
4. Inject `ClassRepository` beside the existing `GradeLevelRepository` in create/update/copy use cases, return the correct `gradeLevel` or `classroom` snapshot to `MealMenu.create/update`, and preserve exact natural-key duplicate checks from @task-msrrs2.
5. Update `src/infra/http/modules/meal-menu.module.ts` to register/export `CLASS_REPOSITORY` using `PrismaClassRepository`, matching the existing local `GRADE_LEVEL_REPOSITORY` provider and Clean Architecture dependency rule in @doc/architecture/clean-architecture-overview.
6. Expand focused tests in `meal-menu.use-case.spec.ts` and `meal-menu.controller.spec.ts`: campus/grade/class success paths, missing targetType legacy rejection for create/update/copy, mismatched id rejection, cross-campus/missing grade and class rejection, and correct class-target natural-key/audit behavior.
7. Validate with focused Jest for meal-menu use-case/controller specs and `npm run build`.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented explicit write target handling for meal menus: create/update/copy DTOs and controller mapping now pass targetType/gradeLevelId/classId, application use cases require targetType, validate campus/grade/class target shapes and campus ownership through repository ports, and MealMenuModule wires CLASS_REPOSITORY. Verification passed: focused/broader meal-menu Jest specs and npm run build.
<!-- SECTION:NOTES:END -->

