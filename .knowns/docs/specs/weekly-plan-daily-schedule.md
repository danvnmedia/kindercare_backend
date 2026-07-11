---
title: Weekly Plan Daily Schedule
description: Specification for class-specific weekly plans with daily schedule blocks
createdAt: '2026-06-18T12:20:30.858Z'
updatedAt: '2026-07-10T22:05:09.258Z'
tags:
  - spec
  - approved
  - weekly-plan
  - schedule
  - api
---

## Overview

Weekly Plan Daily Schedule adds a backend API and persistence model for class-specific weekly plans. Staff can create, list, read, update, copy, archive, restore, and actively look up weekly schedules for classes in the active campus.

Each active Weekly Plan belongs to exactly one campus, one class, and one canonical Monday `weekStartDate`. A plan may include an optional week-level `theme` and a flat list of daily schedule blocks. Each block has a day of week, start/end time, and one or more ordered activities.

Supporting context: @doc/archive/research/weekly-plan-daily-schedule-backend-research and @doc/archive/frontend-handoff/weekly-plan-daily-schedule-frontend-handoff.

## Locked Decisions

- D1: Weekly Plan block times use `HH:mm` strings in API requests/responses for `startTime` and `endTime`; backend validates and normalizes them internally to minutes from midnight for sorting and overlap checks.
- D2: Create and whole-week copy are batch-capable. A single request may target one or more classes, and each resulting Weekly Plan is an independent record.
- D3: Batch create/copy uses partial success. Request-level validation failures abort the whole request, but per-class destination failures return `skipped[]` entries with stable reasons while valid destinations are persisted.
- D4: Whole-week copy preserves the source theme by default and allows the caller to override or clear the theme for copied plans.
- D5: Day-copy stays frontend-local. Backend supports day-copy through normal full-plan update and does not add a dedicated day-copy endpoint in this spec.
- D6: Weekly Plan blocks may use any day of week `1..7`, including Saturday and Sunday. Frontend chooses which days to display by default.
- D7: Weekly Plan responses return a flat `blocks[]` list with `dayOfWeek`; empty days are omitted and can be grouped by the frontend.
- D8: `theme` is optional with max length 255 after trim. Activity text is required after trim with max length 500.
- D9: Weekly Plan create, copy, update, archive, and restore emit audit events in the first backend implementation, using the same transaction-bound audit pattern as meal-menu.
- D10: Active lookup returns `200` with `plan: null` when the class/week is valid but no active plan exists; missing or cross-campus classes still return not-found behavior.

## Requirements

### Functional Requirements

- FR-1: The backend must expose a new `weekly-plans` API surface for campus-scoped Weekly Plan operations.
- FR-2: The backend must persist Weekly Plans as campus-scoped, class-specific weekly records with `campusId`, `classId`, `weekStartDate`, optional `theme`, `isArchived`, `createdAt`, and `updatedAt`.
- FR-3: The backend must persist a Weekly Plan's schedule as flat blocks. Each block must include `dayOfWeek`, `startTime`, `endTime`, and ordered activities.
- FR-4: API requests and responses must represent block times as `HH:mm` strings.
- FR-5: The backend must normalize and validate `weekStartDate` as a date-only Monday anchor.
- FR-6: The backend must validate that every referenced class exists in the active campus before creating, copying, updating target class/week data, or performing active lookup.
- FR-7: The backend must enforce one active Weekly Plan per campus/class/week.
- FR-8: Archived Weekly Plans must not block creating another active Weekly Plan for the same campus/class/week.
- FR-9: Restoring an archived Weekly Plan must fail when another active Weekly Plan exists for the same campus/class/week.
- FR-10: The backend must reject mutation of archived Weekly Plans except restore.
- FR-11: The backend must validate each block has `dayOfWeek` in `1..7`, valid `HH:mm` times, `startTime < endTime`, and at least one valid activity.
- FR-12: The backend must reject overlapping blocks within the same day. A block ending exactly when another starts is allowed.
- FR-13: The backend must trim `theme`; blank or `null` theme clears the value; non-empty theme must not exceed 255 characters.
- FR-14: The backend must trim activity text, reject blank activities, enforce max length 500, and preserve activity order within each block.
- FR-15: Weekly Plan responses must include enough class context for table rows and headers, including at least class ID and class display name; grade/school-year context may be included when already available from class lookup.
- FR-16: `GET /weekly-plans` must list Weekly Plans for the active campus using standard pagination, sorting, and filtering conventions.
- FR-17: The list endpoint must support filtering by `classId`, `weekStartDate`, `isArchived`, `createdAt`, and `updatedAt`; archived plans are excluded by default unless an `isArchived` filter is supplied.
- FR-18: `GET /weekly-plans/:id` must fetch one plan in the active campus, including archived plans for authorized read callers.
- FR-19: `GET /weekly-plans/active` must look up the active plan for one `classId` and one `weekStartDate`.
- FR-20: Active lookup must return `plan: null` for a valid class/week with no active plan and not-found behavior for missing or cross-campus classes.
- FR-21: `POST /weekly-plans` must create independent Weekly Plans for one or more `classIds` in one request.
- FR-22: Batch create must treat invalid schedule shape, empty `classIds`, duplicate class IDs in the request, invalid week, and invalid payload format as whole-request validation failures.
- FR-23: Batch create must treat per-class destination failures such as missing/cross-campus class or active-plan conflict as `skipped[]` entries, while valid class destinations are created.
- FR-24: `PATCH /weekly-plans/:id` must update one active Weekly Plan and replace the full `blocks[]` schedule atomically when blocks are supplied.
- FR-25: `POST /weekly-plans/:id/copy` must copy an active source plan's blocks and activities to one destination `weekStartDate` and one or more destination `classIds`.
- FR-26: Whole-week copy must preserve source theme by default and support optional theme override or clearing.
- FR-27: Batch copy must treat invalid source plan, archived source plan, invalid destination week, duplicate destination class IDs, and invalid override payload as whole-request validation failures.
- FR-28: Batch copy must treat per-class destination failures such as missing/cross-campus destination class or active-plan conflict as `skipped[]` entries, while valid destinations are copied.
- FR-29: `DELETE /weekly-plans/:id` must archive a Weekly Plan rather than hard-delete it.
- FR-30: `PATCH /weekly-plans/:id/restore` must restore an archived Weekly Plan only when active uniqueness would not be violated.
- FR-31: Day-copy is not a backend endpoint. Frontend may copy one day into another locally and submit the resulting full schedule through `PATCH /weekly-plans/:id`.
- FR-32: The backend must seed and enforce Weekly Plan permissions: `weekly_plan.list`, `weekly_plan.read`, `weekly_plan.create`, `weekly_plan.update`, and `weekly_plan.delete`.
- FR-33: Mutating Weekly Plan operations must emit audit events for create, copy, update, archive, and restore.

### Non-Functional Requirements

- NFR-1: Weekly Plan data must be isolated by active campus context; clients must not supply or override `campusId` in request bodies.
- NFR-2: Cross-campus class references must not leak existence details and must use not-found style behavior.
- NFR-3: Active uniqueness must be protected at both application and database levels so concurrent requests cannot create duplicate active campus/class/week plans.
- NFR-4: Mutations and their audit records must commit or roll back together in a single database transaction.
- NFR-5: Schedule update and copy operations must preserve block and activity order deterministically in responses.
- NFR-6: The implementation must follow existing Clean Architecture, StandardResponse, pagination/filtering, RBAC, audit, and Prisma migration conventions documented in the supporting research.

## Acceptance Criteria

- [ ] AC-1: Creating a Weekly Plan for one valid active-campus class succeeds and returns ID, campus ID, class context, Monday week start, nullable theme, sorted flat `blocks[]`, `isArchived=false`, `createdAt`, and `updatedAt`.
- [ ] AC-2: Creating Weekly Plans for multiple valid classes in one request creates independent records, one per class.
- [ ] AC-3: Editing one plan created from a batch does not modify any other plan from the same batch.
- [ ] AC-4: Creating or copying to a class/week that already has an active plan returns a stable per-class skipped reason in batch flows.
- [ ] AC-5: A single-destination create or copy where the only destination conflicts reports the conflict without creating a duplicate active plan.
- [ ] AC-6: Archived plans do not block creating a new active plan for the same campus/class/week.
- [ ] AC-7: Restoring an archived plan fails with a conflict when another active plan exists for the same campus/class/week.
- [ ] AC-8: Non-Monday `weekStartDate` values are rejected for create, update, copy, and active lookup.
- [ ] AC-9: Missing or cross-campus class IDs are rejected with not-found behavior for create, copy, and active lookup.
- [ ] AC-10: `GET /weekly-plans/active` returns `200` with `plan: null` when a valid class/week has no active plan.
- [ ] AC-11: Blocks with malformed `HH:mm`, `startTime >= endTime`, missing activities, blank activities, or overlength activities are rejected.
- [ ] AC-12: Overlapping blocks within the same day are rejected; adjacent blocks where previous `endTime` equals next `startTime` are accepted.
- [ ] AC-13: Blocks may use `dayOfWeek` values `1..7`; empty days are omitted from the response.
- [ ] AC-14: Multiple activities in one block round-trip in the submitted order.
- [ ] AC-15: Updating a plan replaces the stored schedule atomically and returns the normalized, sorted result.
- [ ] AC-16: Copying a whole week preserves source blocks and activities and preserves the source theme unless override/clear is supplied.
- [ ] AC-17: Archived source plans cannot be copied, and archived plans cannot be updated except through restore.
- [ ] AC-18: `GET /weekly-plans` supports standard pagination, sorting, and allowed filters, defaults to active records, and can include archived records when `isArchived` is explicitly filtered.
- [ ] AC-19: Weekly Plan routes enforce campus access and the correct `weekly_plan.*` permissions.
- [ ] AC-20: Create, copy, update, archive, and restore emit the expected audit action in the same transaction as the mutation.
- [ ] AC-21: Concurrent duplicate create/copy/restore attempts cannot produce two active plans for the same campus/class/week.

## Scenarios

### Scenario 1: Create One Weekly Plan
**Given** an authorized staff user in campus C and class K1 belongs to campus C
**When** the user creates a Weekly Plan for K1 with Monday `weekStartDate`, a theme, and valid blocks
**Then** the backend saves one active plan and returns the plan with class context and normalized blocks.

### Scenario 2: Batch Create Independent Plans
**Given** classes K1 and K2 both belong to campus C
**When** the user creates Weekly Plans for `[K1, K2]` in one request
**Then** the backend creates two independent plans with different IDs and the same submitted schedule content.

### Scenario 3: Batch Create Partial Conflict
**Given** class K1 already has an active plan for week W and class K2 does not
**When** the user creates Weekly Plans for `[K1, K2]` for week W
**Then** the backend creates a plan for K2 and returns K1 in `skipped[]` with reason `ACTIVE_WEEKLY_PLAN_EXISTS`.

### Scenario 4: Active Lookup Empty State
**Given** class K1 belongs to campus C and has no active plan for week W
**When** the user requests `GET /weekly-plans/active?classId=K1&weekStartDate=W`
**Then** the backend returns success with `plan: null`.

### Scenario 5: Reject Cross-Campus Class
**Given** class X belongs to another campus
**When** a user in campus C creates, copies, or actively looks up a Weekly Plan using class X
**Then** the backend returns not-found behavior and does not reveal cross-campus data.

### Scenario 6: Reject Overlapping Blocks
**Given** a plan payload has two Monday blocks, `09:00-10:00` and `09:30-10:30`
**When** the user submits create or update
**Then** the backend rejects the payload with a validation error.

### Scenario 7: Allow Adjacent Blocks
**Given** a plan payload has two Monday blocks, `09:00-10:00` and `10:00-10:30`
**When** the user submits create or update
**Then** the backend accepts both blocks and returns them in chronological order.

### Scenario 8: Copy Whole Week With Theme Override
**Given** an active source Weekly Plan has theme `Community Helpers`
**When** the user copies it to another valid class/week with theme override `Spring Review`
**Then** the copied plan has the source schedule content and the overridden theme.

### Scenario 9: Restore Conflict
**Given** an archived Weekly Plan exists for class K1 and week W, and another active Weekly Plan now exists for K1 and W
**When** the user attempts to restore the archived plan
**Then** the backend rejects restore with a conflict and leaves the archived plan unchanged.

### Scenario 10: Frontend Day Copy Through Update
**Given** a user copies Monday's blocks into Wednesday in the frontend editor
**When** the frontend submits the resulting full `blocks[]` through `PATCH /weekly-plans/:id`
**Then** the backend validates the final schedule and updates the plan if it satisfies all block/activity rules.

## Technical Notes

- Recommended route names: `GET /weekly-plans`, `GET /weekly-plans/active`, `GET /weekly-plans/:id`, `POST /weekly-plans`, `PATCH /weekly-plans/:id`, `POST /weekly-plans/:id/copy`, `DELETE /weekly-plans/:id`, `PATCH /weekly-plans/:id/restore`.
- Recommended response shape uses flat `blocks[]` entries with `dayOfWeek`, `startTime`, `endTime`, and `activities[]` ordered by `order`.
- Recommended persistence uses a parent `WeeklyPlan`, child `WeeklyPlanBlock`, and child `WeeklyPlanActivity` model. Child block/activity rows may be replaced wholesale on update, following the meal-menu pattern.
- Recommended database uniqueness uses an active-only partial unique index on `(campus_id, class_id, week_start_date) WHERE is_archived = false`.
- Recommended audit actions: `CREATE_WEEKLY_PLAN`, `COPY_WEEKLY_PLAN`, `UPDATE_WEEKLY_PLAN`, `ARCHIVE_WEEKLY_PLAN`, and `RESTORE_WEEKLY_PLAN`.
- Recommended stable skipped reasons include `CLASS_NOT_FOUND`, `CLASS_NOT_IN_CAMPUS`, and `ACTIVE_WEEKLY_PLAN_EXISTS`. Missing and cross-campus class behavior may collapse to the same not-found reason if required for privacy.
- Backend should avoid Meal Menu effective fallback semantics. Weekly Plans are class-only and exact.

## Open Questions

None. The behavioral choices needed for this draft are locked in D1-D10.
