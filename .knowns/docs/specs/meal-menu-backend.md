---
title: Meal Menu Backend
description: Specification for the v1 campus-scoped meal menu backend APIs, config, copy, restore, audit, validation, RBAC, and persistence requirements.
createdAt: '2026-05-30T02:06:38.036Z'
updatedAt: '2026-06-01T17:19:36.122Z'
tags:
  - spec
  - approved
  - backend
  - meal-menu
  - audit
  - frontend-handoff
---

## Overview

Backend support for the v1 Meal Menu System. The feature provides campus-scoped admin APIs to manage weekly meal menus, campus meal-menu defaults, copy/duplicate flows, restore flows, and audit coverage for all meal-menu mutations.

A meal menu is a weekly grid anchored by a Monday `weekStartDate` and targeted either to the whole campus or to one grade level. Each menu snapshots its operating days and meal-slot labels so later config changes do not mutate existing menus. Grid cells contain free-text meal descriptions only.

Supporting references:

- @doc/references/meal-menu-system-backend-handoff
- @doc/references/meal-menu-backend-research
- @doc/guides/working-with-campuses
- @doc/patterns/guards-pattern
- @doc/patterns/decorators-pattern
- @doc/patterns/standard-response-pattern
- @doc/architecture/rbac-system

## Locked Decisions

- D1: v1 includes the required admin management API, restore support, a dedicated copy endpoint, and audit events. Audit-covered mutations are create, copy, update/replace grid, archive, restore, and config update. Dedicated viewer/class resolution, parent/staff viewer, export/import, nutrition/allergen metadata, and multi-week templates are out of scope.
- D2: `GET /meal-menus/config` returns virtual defaults when no campus config row exists. It must not create a row on read. A row is persisted only when an admin calls `PUT /meal-menus/config`.
- D3: `GET /meal-menus` uses dedicated target query params instead of relying on `gradeLevelId = null` in the standard JSON filter grammar.
- D4: `POST /meal-menus/:id/copy` copies the full source grid exactly: `days`, `mealSlots`, and all non-blank entries. The caller supplies destination `weekStartDate`, destination `gradeLevelId|null`, and optional `title`.
- D5: archived meal menus are hidden by default but remain readable/filterable by authorized admins. Archived menus cannot be updated or copied until restored. Restore is subject to uniqueness rules.
- D6: entry descriptions are trimmed; entries blank after trimming are omitted from storage and omitted from responses.
- D7: backend rejects non-Monday `weekStartDate`. Weeks where Monday has no meals are represented by omitting Monday from `days`, not by moving the week anchor.
- D8: `POST /meal-menus` treats `days` and `mealSlots` as optional. When omitted, backend snapshots saved campus config or virtual defaults. Existing menus are not affected by later config changes.

## Requirements

### Functional Requirements

- FR-1: Provide a new campus-scoped meal-menu backend surface under `/meal-menus` for authorized admin management.
- FR-2: Provide `GET /meal-menus` as a paginated list using standard response pagination and sorting conventions.
- FR-3: `GET /meal-menus` must return each menu with its entries and optional grade-level summary so the frontend can expand rows into an inline grid without a separate detail fetch.
- FR-4: `GET /meal-menus` must exclude archived menus by default.
- FR-5: `GET /meal-menus` must allow authorized admins to include/filter archived menus with the standard `isArchived` filter.
- FR-6: `GET /meal-menus` must support filtering by `weekStartDate` with standard scalar/range filter conventions.
- FR-7: `GET /meal-menus` must support target filtering via dedicated query params:
  - omitted `target` or `target=all`: return both whole-campus and grade-level menus.
  - `target=campus`: return only whole-campus menus.
  - `target=grade&gradeLevelId=<uuid>`: return menus for the specified grade level.
- FR-8: `GET /meal-menus` default sort must be `weekStartDate` descending unless caller supplies a valid sort.
- FR-9: Provide `GET /meal-menus/:id` to return one campus-scoped menu with entries and optional grade-level summary, including archived menus for authorized admins.
- FR-10: Provide `POST /meal-menus` to create a weekly menu for either the whole campus or one grade level.
- FR-11: `POST /meal-menus` must accept `weekStartDate`, `gradeLevelId|null`, optional `title`, optional `days`, optional `mealSlots`, and optional `entries`.
- FR-12: On create, if `days` is omitted, backend must snapshot saved campus config `operatingDays` or virtual default `[1,2,3,4,5]`.
- FR-13: On create, if `mealSlots` is omitted, backend must snapshot saved campus config `defaultMealSlots` or virtual default `["Breakfast","Lunch","Afternoon"]`.
- FR-14: The backend must enforce only one menu per `(campusId, gradeLevelId|null, weekStartDate)`, including whole-campus rows where `gradeLevelId` is null.
- FR-15: Provide `PATCH /meal-menus/:id` to update menu metadata and replace the whole grid in one explicit save operation.
- FR-16: `PATCH /meal-menus/:id` may update `title`, `weekStartDate`, `gradeLevelId|null`, `days`, `mealSlots`, and `entries`, subject to the same validation and uniqueness rules as create.
- FR-17: `PATCH /meal-menus/:id` must reject updates to archived menus until restored.
- FR-18: Provide `DELETE /meal-menus/:id` to soft-archive a menu rather than physically deleting it.
- FR-19: Provide `PATCH /meal-menus/:id/restore` to unarchive a menu, subject to uniqueness conflicts with any active menu for the same campus, target, and week.
- FR-20: Provide `POST /meal-menus/:id/copy` to duplicate a source menu into a new destination week/target.
- FR-21: `POST /meal-menus/:id/copy` must copy the source menu's `days`, `mealSlots`, and all non-blank entries exactly.
- FR-22: `POST /meal-menus/:id/copy` must require destination `weekStartDate` and destination `gradeLevelId|null`, and may accept optional `title`.
- FR-23: `POST /meal-menus/:id/copy` must reject archived source menus.
- FR-24: Provide `GET /meal-menus/config` to return campus-scoped meal-menu defaults.
- FR-25: If no config row exists, `GET /meal-menus/config` must return virtual defaults without writing to the database:
  - `operatingDays: [1,2,3,4,5]`
  - `defaultMealSlots: ["Breakfast","Lunch","Afternoon"]`
- FR-26: Provide `PUT /meal-menus/config` to upsert campus-scoped meal-menu defaults for future menus only.
- FR-27: Config updates must not mutate existing menus because menus snapshot `days` and `mealSlots`.
- FR-28: All meal-menu endpoints must resolve campus from existing campus guard/context conventions and must not trust `campusId` from request bodies.
- FR-29: Any grade-level target must belong to the active campus; missing or cross-campus grade levels must not allow cross-campus data leakage.
- FR-30: All mutation endpoints must emit audit events atomically with the persistence change: create, copy, update, archive, restore, and config update.
- FR-31: New routes must use permission-based RBAC, not legacy role-name-only gates.
- FR-32: Permission IDs must follow the existing dot-format convention, using at least:
  - `meal_menu.list`
  - `meal_menu.read`
  - `meal_menu.create`
  - `meal_menu.update`
  - `meal_menu.delete`
  - `meal_menu_config.read`
  - `meal_menu_config.update`

### Validation Requirements

- VR-1: `weekStartDate` must be a valid date/datetime with date-only semantics after normalization.
- VR-2: `weekStartDate` must be a Monday. Non-Monday dates must be rejected.
- VR-3: `days` must be a non-empty array of unique integers in the range `1..7`, where `1=Monday` and `7=Sunday`.
- VR-4: `mealSlots` must be a non-empty ordered array of trimmed, non-empty, unique labels.
- VR-5: Every entry's `dayOfWeek` must exist in the resolved `days` snapshot.
- VR-6: Every entry's `slot` must exist in the resolved `mealSlots` snapshot after slot normalization/trimming.
- VR-7: Duplicate submitted entry cells for the same `(dayOfWeek, slot)` must be rejected.
- VR-8: Entry descriptions must be trimmed.
- VR-9: Entries with blank descriptions after trimming must be omitted from storage and responses.
- VR-10: Whole-campus target is represented by `gradeLevelId: null`.
- VR-11: A grade-level target must be an existing grade level in the active campus.
- VR-12: Create, update, copy, and restore must return a clear 4xx conflict when uniqueness for `(campusId, gradeLevelId|null, weekStartDate)` would be violated.
- VR-13: `target=grade` list requests must require a valid `gradeLevelId` query param.
- VR-14: `target=campus` list requests must ignore or reject an accompanying `gradeLevelId`; the implementation must document the chosen behavior in DTO/API docs.
- VR-15: Config `operatingDays` must follow the same validation as menu `days`.
- VR-16: Config `defaultMealSlots` must follow the same validation as menu `mealSlots`.

### Non-Functional Requirements

- NFR-1: Follow the repository's Clean Architecture layering: Domain → Application → Infrastructure → HTTP.
- NFR-2: Follow existing StandardResponse conventions for paginated and non-paginated responses.
- NFR-3: Enforce campus scope in use cases/repositories as system scope, not as user-controlled filters.
- NFR-4: Prevent cross-campus read/write leakage for menus, entries, config, grade-level targets, and copy sources.
- NFR-5: Use normalized persistence for menu entries rather than storing the whole grid as opaque JSON.
- NFR-6: Enforce whole-campus uniqueness at the database level using the project's raw-SQL nullable-uniqueness pattern, because Prisma/PostgreSQL default unique semantics do not treat nulls as equal.
- NFR-7: Keep config reads side-effect free when no config row exists.
- NFR-8: Audit events must be written in the same transaction/unit of work as the mutation they describe.
- NFR-9: API behavior must be documented in Swagger/OpenAPI DTO decorators consistently with existing controllers.
- NFR-10: The implementation must include tests for domain validation, use cases, repository persistence where practical, and HTTP/controller behavior consistent with adjacent modules.

## Acceptance Criteria

- [x] AC-1: Authorized admin can list active meal menus for the active campus and receives paginated standard response metadata, entries, and grade-level summaries.
- [x] AC-2: By default, archived menus are excluded from `GET /meal-menus`.
- [x] AC-3: Authorized admin can include/filter archived menus via `isArchived` and can retrieve an archived menu by ID.
- [x] AC-4: `GET /meal-menus` supports `target=all`, omitted target, `target=campus`, and `target=grade&gradeLevelId=<uuid>` as specified in D3.
- [x] AC-5: `GET /meal-menus` supports week/date filtering via standard `weekStartDate` filter conventions and defaults to `weekStartDate` descending.
- [x] AC-6: Authorized admin can create a whole-campus menu with omitted `days` and `mealSlots`; backend snapshots saved config or virtual defaults.
- [x] AC-7: Authorized admin can create a grade-level menu only when the grade level belongs to the active campus.
- [x] AC-8: Creating a duplicate active menu for the same campus, target, and Monday week returns a conflict error, including the whole-campus `gradeLevelId=null` case.
- [x] AC-9: Non-Monday `weekStartDate` is rejected for create, update, and copy destination.
- [x] AC-10: Invalid `days`, invalid `mealSlots`, duplicate cells, cells outside enabled days/slots, and cross-campus grade targets return predictable 4xx errors.
- [x] AC-11: Blank entry descriptions are trimmed and omitted from stored entries and response entries.
- [x] AC-12: Authorized admin can update an active menu with a whole-grid replacement, and the final response reflects the replaced grid.
- [x] AC-13: Updating an archived menu is rejected until it is restored.
- [x] AC-14: Authorized admin can soft-archive a menu with `DELETE /meal-menus/:id`; the row is hidden from default list results.
- [x] AC-15: Authorized admin can restore an archived menu with `PATCH /meal-menus/:id/restore` when no active uniqueness conflict exists.
- [x] AC-16: Restore returns a conflict error when another active menu already uses the same campus, target, and week.
- [x] AC-17: Authorized admin can copy an active source menu with `POST /meal-menus/:id/copy`; destination menu contains copied `days`, `mealSlots`, and entries.
- [x] AC-18: Copying an archived source menu is rejected.
- [x] AC-19: `GET /meal-menus/config` returns virtual defaults when no config row exists and does not create a row.
- [x] AC-20: `PUT /meal-menus/config` upserts defaults and affects future menu creation only.
- [x] AC-21: All mutation endpoints produce audit events atomically with persistence changes.
- [x] AC-22: Endpoints require authentication, campus access, and the appropriate meal-menu permission IDs.
- [x] AC-23: Cross-campus IDs in route params, copy source, grade target, or config access do not leak data across campuses.
- [x] AC-24: Prisma schema/migration enforces normalized entries and database-level natural uniqueness for nullable whole-campus targets.
- [x] AC-25: Existing response/error conventions are followed and validation/test coverage is sufficient for the above acceptance criteria.

## Scenarios

### Scenario 1: Create whole-campus menu with backend defaults

- **Given** an authorized admin has access to campus A and no saved meal-menu config exists for campus A
- **When** they call `POST /meal-menus` with Monday `weekStartDate`, `gradeLevelId: null`, and no `days` or `mealSlots`
- **Then** the backend creates a whole-campus menu for campus A with `days=[1,2,3,4,5]`, `mealSlots=["Breakfast","Lunch","Afternoon"]`, stores only non-blank entries, and emits a create audit event.

### Scenario 2: Create grade-level menu

- **Given** an authorized admin has access to campus A and grade level G belongs to campus A
- **When** they create a menu with `gradeLevelId=G`, a Monday `weekStartDate`, valid `days`, valid `mealSlots`, and valid entries
- **Then** the backend creates the menu for grade level G, includes grade-level summary in the response, and prevents a second active menu for the same campus/grade/week.

### Scenario 3: Reject cross-campus grade target

- **Given** an authorized admin has access to campus A and grade level G belongs to campus B
- **When** they attempt to create, update, copy, or list with `target=grade&gradeLevelId=G` under campus A
- **Then** the backend rejects the request without leaking campus B data.

### Scenario 4: Filter whole-campus menus

- **Given** campus A has whole-campus and grade-level menus for the same date range
- **When** an authorized admin calls `GET /meal-menus?target=campus`
- **Then** the response includes only menus where `gradeLevelId` is null.

### Scenario 5: Copy full grid

- **Given** an active source menu exists in campus A with days, meal slots, and non-blank entries
- **When** an authorized admin calls `POST /meal-menus/:id/copy` with a new Monday `weekStartDate` and destination `gradeLevelId|null`
- **Then** the backend creates a new menu with the source days, meal slots, and entries, applies create-time validation and uniqueness checks, and emits a copy audit event.

### Scenario 6: Archive and restore

- **Given** an active menu exists in campus A
- **When** an authorized admin calls `DELETE /meal-menus/:id`
- **Then** the menu is marked archived and disappears from default list results.
- **When** the admin calls `PATCH /meal-menus/:id/restore` and no active uniqueness conflict exists
- **Then** the menu is unarchived, appears in default list results, and archive/restore audit events exist.

### Scenario 7: Restore conflict

- **Given** an archived menu and an active menu share the same campus, target, and Monday week
- **When** an authorized admin attempts to restore the archived menu
- **Then** the backend returns a conflict error and leaves the archived menu unchanged.

### Scenario 8: Config virtual defaults

- **Given** no meal-menu config row exists for campus A
- **When** an authorized admin calls `GET /meal-menus/config`
- **Then** the backend returns `operatingDays=[1,2,3,4,5]` and `defaultMealSlots=["Breakfast","Lunch","Afternoon"]` without creating a row.

### Scenario 9: Config update affects future menus only

- **Given** an existing menu has snapshotted Mon-Fri days and default slots
- **When** an authorized admin updates meal-menu config to include Saturday and a different slot list
- **Then** the existing menu remains unchanged, and newly created menus that omit `days` or `mealSlots` snapshot the new config values.

### Scenario 10: Monday holiday

- **Given** a week has no meals on Monday
- **When** an authorized admin creates the menu
- **Then** they still provide the Monday calendar anchor as `weekStartDate` and omit Monday from `days`, for example `days=[2,3,4,5]`.
## Technical Notes

- Implement as a new clean-architecture feature/module rather than extending CMS `CampusSetting`.
- Use normalized persistence: parent `meal_menu`, child `meal_menu_entry`, and dedicated campus-scoped `meal_menu_config`.
- Use `isArchived` for soft archive semantics, matching frontend response expectations and adjacent admin/reference patterns.
- Database uniqueness for `(campus_id, grade_level_id, week_start_date)` must treat null grade-level IDs as equal. Use the existing project pattern: keep schema awareness where useful, then enforce actual SQL uniqueness with `NULLS NOT DISTINCT` or equivalent partial unique indexes in the migration.
- Use permission IDs in dot format, not frontend handoff colon format.
- Use `@RequireCampusAccess()` and `@CampusContext()` conventions. `campusId` is system context, never trusted from request bodies.
- Prefer NotFound-style behavior for cross-campus related entity access where consistent with newer use cases.
- Whole-grid update may be implemented as replace-all entries within the same transaction as parent update and audit event.
- Copy should behave like create using source grid data plus destination target/week/title.
- The standard JSON filter grammar should not be changed for null equality as part of this spec; D3 avoids that cross-cutting change.

## Open Questions

- [x] OQ-1: Resolved: `target=campus` rejects a supplied `gradeLevelId` with a 400 response and the predictable message `gradeLevelId is only supported when target=grade`.
- [x] OQ-2: Resolved: the meal-menu module follows @doc/patterns/exception-pattern and uses NestJS default error responses with predictable messages instead of introducing module-specific machine-readable error codes.
