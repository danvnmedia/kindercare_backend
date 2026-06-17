---
title: Meal Menu Class Targeting
description: Specification for adding individual class targets and effective class fallback lookup to meal menus
createdAt: '2026-06-03T16:02:52.214Z'
updatedAt: '2026-06-03T16:05:43.816Z'
tags:
  - spec
  - approved
  - meal-menu
---

## Overview

Extend meal menus from the current whole-campus and grade-level target model to also support individual class targets. The feature preserves existing campus and grade scopes, adds an explicit class scope, and introduces an effective class lookup that resolves the most specific applicable menu for a class and week.

## Locked Decisions

- D1: Meal menus use explicit single-target scopes: `campus`, `grade`, and `class`. Campus and grade targets are not expanded into arrays of classes.
- D2: Effective class lookup resolves by specificity: class menu first, then the class's grade-level menu, then whole-campus menu.
- D3: Broader defaults and narrower overrides may coexist in the same week. Only duplicate active menus at the same exact target identity are rejected.
- D4: Create, update, and copy requests use explicit `targetType: "campus" | "grade" | "class"` with exactly the matching target id field when required.
- D5: List endpoints use exact target filtering. Effective fallback resolution is exposed through a separate class/week lookup endpoint.
- D6: The migrated API requires explicit `targetType` immediately. Legacy request shapes that infer target from omitted or supplied `gradeLevelId` are not supported.
- D7: Class targets validate that the class belongs to the active campus. Callers do not supply a grade for class menus; the backend derives grade context from the class for fallback and response context.
- D8: Effective lookup returns `200` with `menu: null` when no applicable menu exists. Missing or cross-campus class still returns `404`.

## Requirements

### Functional Requirements

- FR-1: Meal menus must support three target types: `campus`, `grade`, and `class`.
- FR-2: A campus-targeted menu must not require or accept `gradeLevelId` or `classId`.
- FR-3: A grade-targeted menu must require `gradeLevelId` and must not accept `classId`.
- FR-4: A class-targeted menu must require `classId` and must not accept `gradeLevelId` from the caller.
- FR-5: The backend must validate that grade and class targets belong to the active campus context before persisting or querying target-specific menus.
- FR-6: Existing meal menu rows must migrate to the new explicit target model: rows with `gradeLevelId = null` become `targetType=campus`; rows with `gradeLevelId != null` become `targetType=grade`.
- FR-7: Active uniqueness must be enforced per campus, week, target type, and exact target id, while archived menus remain historical and do not block creating a new active menu.
- FR-8: `GET /meal-menus` must support exact target filters for `campus`, `grade`, and `class` targets.
- FR-9: A separate effective lookup endpoint must resolve the applicable menu for a class and week using class -> grade -> campus fallback.
- FR-10: Effective lookup responses must identify which target type was resolved when a menu is found.
- FR-11: Create, update, and copy APIs must require explicit `targetType` and reject legacy/inferred target request shapes.
- FR-12: Responses for meal menus must expose enough target context for clients to distinguish campus, grade, and class menus.

### Non-Functional Requirements

- NFR-1: Target validation must prevent cross-campus leakage for class and grade targets.
- NFR-2: Migration must preserve existing active and archived meal menu history.
- NFR-3: Existing meal menu grid behavior, archive/restore behavior, audit recording, pagination, sorting, and allowed standard filters must continue to work unless explicitly changed by this spec.

## Acceptance Criteria

- [ ] AC-1: Creating a `targetType=campus` menu with no target ids succeeds; supplying `gradeLevelId` or `classId` is rejected.
- [ ] AC-2: Creating a `targetType=grade` menu with a valid campus-owned `gradeLevelId` succeeds; missing `gradeLevelId`, supplying `classId`, or using a cross-campus/missing grade is rejected.
- [ ] AC-3: Creating a `targetType=class` menu with a valid campus-owned `classId` succeeds; missing `classId`, supplying `gradeLevelId`, or using a cross-campus/missing class is rejected.
- [ ] AC-4: Updating or copying a menu applies the same target validation rules as creation.
- [ ] AC-5: Duplicate active campus menus for the same campus and week are rejected.
- [ ] AC-6: Duplicate active grade menus for the same campus, grade, and week are rejected.
- [ ] AC-7: Duplicate active class menus for the same campus, class, and week are rejected.
- [ ] AC-8: A campus menu, a grade menu, and one or more class menus for the same campus/week can coexist when their exact target identities differ.
- [ ] AC-9: `GET /meal-menus?target=class&classId=<id>` returns exact class-targeted menus only.
- [ ] AC-10: `GET /meal-menus?target=grade&gradeLevelId=<id>` returns exact grade-targeted menus only.
- [ ] AC-11: `GET /meal-menus?target=campus` returns exact campus-targeted menus only.
- [ ] AC-12: Effective lookup for a class/week returns the class-specific menu when present.
- [ ] AC-13: Effective lookup falls back to the class's grade-level menu when no class-specific menu exists.
- [ ] AC-14: Effective lookup falls back to the whole-campus menu when no class or grade menu exists.
- [ ] AC-15: Effective lookup returns `200` with `menu: null` when no class, grade, or campus menu applies.
- [ ] AC-16: Effective lookup returns `404` for a missing class or class outside the active campus.
- [ ] AC-17: Migration converts existing rows to explicit target types without losing existing menu entries, archive state, dates, titles, or audit-relevant data.
- [ ] AC-18: The old implicit create/update/copy/list target shape is rejected after migration when `targetType` is absent.

## Scenarios

### Scenario 1: Create Class-Specific Menu
**Given** a class belongs to the active campus
**When** an authorized caller creates a meal menu with `targetType=class` and that `classId`
**Then** the menu is saved as a class-targeted menu and includes class target context in the response.

### Scenario 2: Reject Cross-Campus Class Target
**Given** a class belongs to another campus
**When** an authorized caller creates, updates, copies, lists, or performs effective lookup using that class in the active campus context
**Then** the request fails with not-found style behavior and no cross-campus data is returned.

### Scenario 3: Effective Lookup Uses Class Override
**Given** a class-specific menu, a grade-level menu, and a campus menu all exist for the same week
**When** the caller requests the effective menu for that class/week
**Then** the class-specific menu is returned and the response reports that the resolved target is `class`.

### Scenario 4: Effective Lookup Falls Back To Grade
**Given** a grade-level menu and campus menu exist for the class's week, but no class-specific menu exists
**When** the caller requests the effective menu for that class/week
**Then** the grade-level menu is returned and the response reports that the resolved target is `grade`.

### Scenario 5: Effective Lookup Falls Back To Campus
**Given** a campus menu exists for the class's week, but no class or grade menu exists
**When** the caller requests the effective menu for that class/week
**Then** the campus menu is returned and the response reports that the resolved target is `campus`.

### Scenario 6: No Effective Menu Exists
**Given** the class exists in the active campus and no class, grade, or campus menu exists for the requested week
**When** the caller requests the effective menu for that class/week
**Then** the response is successful and contains `menu: null`.

### Scenario 7: Exact Duplicate Is Rejected
**Given** an active class-targeted menu already exists for class C1 in week W
**When** a caller attempts to create another active class-targeted menu for C1 in week W
**Then** the request is rejected as a duplicate.

### Scenario 8: Broader And Narrower Menus Coexist
**Given** an active grade-level menu exists for grade G1 in week W
**When** a caller creates an active class-targeted menu for class C1 in grade G1 for week W
**Then** the class menu is allowed and becomes the effective menu for C1.

## Technical Notes

- Current implementation stores `MealMenu.gradeLevelId` as the only target discriminator; this spec requires an explicit target model that can represent campus, grade, or class.
- Current `Class` domain exposes `campusId` and `gradeLevelId`, and `ClassRepository` supports class lookup. Effective lookup should use the class's `gradeLevelId` for grade fallback.
- Response DTOs should include explicit target information, such as `targetType`, `gradeLevelId`, `classId`, and optional target summaries where available.
- The effective lookup endpoint should be separate from the paginated list endpoint to keep list filtering exact and predictable.
- The planner should decide the concrete persistence shape, but it must enforce the active exact-target uniqueness from D3.

## Open Questions

None.
