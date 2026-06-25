---
title: Weekly Plan Daily Schedule Frontend Handoff
description: Frontend-to-backend handoff for the Weekly Plan Daily Schedule feature
createdAt: '2026-06-18T02:27:18.948Z'
updatedAt: '2026-06-18T02:27:18.948Z'
tags:
  - frontend-handoff
  - weekly-plan
  - schedule
  - api
---

## Purpose

This handoff summarizes the approved frontend feature direction for Weekly Plan Daily Schedule and highlights the backend support the frontend is likely to need. It is intentionally not a backend implementation spec. Backend devs should use this as product/API context, then research the backend codebase and make their own technical decisions.

Source context: approved frontend spec `specs/weekly-plan-daily-schedule` in the frontend Knowns project. The closest existing backend precedent appears to be @doc/specs/meal-menu-class-targeting, but Weekly Plans have different targeting rules and should not automatically inherit Meal Menu fallback behavior.

## 1. Feature Summary

### What We Are Building

Weekly Plan Daily Schedule is a class-specific weekly schedule feature. Staff can create, edit, copy, archive, restore, and view weekly schedules for classes.

Each weekly plan is for one class and one canonical week. A creation flow may let the user select multiple classes, but that is only a batch creation convenience: the system should create independent class plans, not one shared linked plan.

Each plan includes:

- Target class.
- Canonical Monday `weekStartDate`.
- Optional week-level theme.
- Daily schedule blocks.
- Each block has a start time, end time, and one or more ordered activities.

### Why We Are Building It

Classes need a weekly daily schedule that staff can view by day or week. Some classes may initially use the same schedule, but classes can diverge afterward. The frontend needs backend support for independent per-class plans, duplicate protection, and strict schedule validation.

### Main Frontend User Flow

1. Staff opens Weekly Plans from the dashboard.
2. Staff chooses a week and one or more classes.
3. Staff optionally enters a theme.
4. Staff builds a weekly schedule using daily time blocks.
5. Staff saves the plan.
6. If multiple classes were selected, the UI expects one independent saved plan per class.
7. Staff can later open one class plan in day view or week view.
8. Staff can edit one class plan without affecting plans created for other classes in the same batch.
9. Staff can copy a whole weekly plan to another week/class or copy one day into another day.
10. Staff can archive and restore plans subject to duplicate-plan rules.

## 2. Frontend Spec Summary

### Screens And Components Planned

The frontend will likely mirror the Meal Menu feature structure where useful:

- Weekly Plans dashboard route.
- Weekly Plans data table/list.
- Add Weekly Plan dialog.
- Copy Weekly Plan dialog.
- Weekly Plan editor dialog or page.
- Read-only Weekly Plan view.
- Day view for one class/day.
- Week view for one class/week.
- Class picker, likely reusing existing class list data.
- Archive, restore, and conflict handling UI.

### Important UI States

The frontend needs to represent these states cleanly:

- Initial loading for table/list data.
- Empty state when no plans exist for the selected filters.
- Class/week lookup with no active plan.
- Saving state for create/update/copy/archive/restore.
- Dirty editor state with cancel confirmation.
- Validation errors before save.
- Backend validation errors after save.
- Duplicate class/week conflict.
- Partial batch conflict when some selected classes can be created and others cannot.
- Archived plan state.
- Restore blocked because another active plan exists.
- Permission denied state for users without Weekly Plan permissions.

### User Actions Needed

The frontend needs to support:

- List plans with pagination/filtering/sorting.
- Filter or navigate by class and week.
- Create one plan for one class.
- Create independent plans for multiple selected classes.
- Read plan details.
- Update theme and schedule blocks for one plan.
- Copy a whole plan to another week, another class, or multiple classes.
- Copy one day into another day within the current plan.
- Archive a plan.
- Restore an archived plan.
- View day schedule.
- View whole-week schedule.

### Frontend Validation And Business Rules

The frontend will validate these before submitting, but backend must enforce them too:

- At least one class is selected during create/copy destination flows.
- `weekStartDate` must be a Monday.
- A plan targets exactly one class after creation.
- One class can have only one active plan for the same week.
- Each time block requires `startTime`, `endTime`, and at least one activity.
- `startTime` must be before `endTime`.
- Time blocks within the same day must not overlap.
- Blocks should be persisted/displayed in chronological order.
- Activity entries cannot be empty or whitespace-only.
- Activity order must be preserved.

## 3. Backend Needs And Assumptions

### Data The Frontend Needs

The frontend needs Weekly Plan records that include:

- Plan identity.
- Campus identity or confirmation that the plan belongs to the active campus.
- Class identity and enough class display context for tables and headers.
- Canonical Monday `weekStartDate`.
- Optional theme.
- Daily schedule blocks grouped or groupable by day.
- Time range per block.
- Ordered activities per block.
- Archive/active status.
- Created and updated timestamps.

The frontend also needs existing class list data for selecting destination classes.

### Actions The Frontend Needs To Perform

The backend needs to support, directly or indirectly:

- List Weekly Plans.
- Fetch one Weekly Plan by ID.
- Fetch or resolve the active plan for a class/week.
- Create one or more independent class Weekly Plans.
- Update a Weekly Plan.
- Copy a whole Weekly Plan to one or more destination classes/weeks.
- Archive a Weekly Plan.
- Restore a Weekly Plan.

Day-level copy can be frontend-only if the backend supports full schedule update. The frontend can copy blocks locally from source day to destination day, ask for confirmation if the destination day already has blocks, then submit the updated plan. Backend only needs a dedicated day-copy endpoint if the backend team wants that operation to be server-side for audit, concurrency, or invariants.

### Existing APIs We Think May Be Reusable

Please confirm in the backend codebase:

- Existing class listing/detail APIs should probably support the class picker.
- Existing campus context and campus authorization behavior should apply.
- Existing pagination/filtering conventions should apply to list endpoints.
- Existing Meal Menu APIs are not reusable directly, but they are a useful precedent for weekly records, copy/archive/restore behavior, duplicate active constraints, and class/campus validation.
- Existing RBAC permission seeding/guards should be followed with new Weekly Plan permissions.

### New Or Changed APIs We May Need

The frontend likely needs a new Weekly Plan API surface. Proposed shape is listed below, but backend should decide exact naming and implementation details.

No existing frontend behavior requires changing Meal Menu APIs.

### Backend Behavior Assumed But Not Confirmed

The frontend is currently assuming the backend can support:

- Active campus scoping through the same mechanism used elsewhere.
- Class ownership validation against the active campus.
- Backend validation for Monday week starts.
- Backend validation for non-overlapping time blocks.
- Backend uniqueness for one active plan per campus/class/week.
- Archive and restore semantics similar to other weekly features.
- Batch create/copy behavior that can report per-class conflicts.
- Response shapes compatible with standard frontend API client expectations.

## 4. Suggested API Contract

This section is a proposed frontend-friendly contract, not a backend implementation requirement.

### Proposed Endpoints

- `GET /weekly-plans`
  - List Weekly Plans for the active campus.
  - Supports pagination, sorting, filtering by class, week/date range, and archive status.

- `GET /weekly-plans/:id`
  - Fetch one Weekly Plan.

- `GET /weekly-plans/active`
  - Fetch the active Weekly Plan for one `classId` and one `weekStartDate`.
  - Alternative: support exact `classId + weekStartDate + isArchived=false` filtering on the list endpoint instead.

- `POST /weekly-plans`
  - Create one or more independent Weekly Plans.
  - Frontend preference: allow a `classIds` list so one request can create a batch.

- `PATCH /weekly-plans/:id`
  - Update one Weekly Plan's theme and schedule content.

- `POST /weekly-plans/:id/copy`
  - Copy one Weekly Plan to one or more destination classes/weeks.

- `DELETE /weekly-plans/:id`
  - Archive one Weekly Plan.

- `PATCH /weekly-plans/:id/restore`
  - Restore an archived Weekly Plan if it does not conflict with an active plan.

### Request Payload Shapes

Create request, frontend-preferred shape:

- `classIds`: required list of one or more class IDs.
- `weekStartDate`: required Monday date.
- `theme`: optional text.
- `days` or `blocks`: required or optional depending on backend defaults. If accepted, must describe day schedules.
- Schedule block fields:
  - `dayOfWeek`: required day identifier.
  - `startTime`: required structured time.
  - `endTime`: required structured time.
  - `activities`: required ordered list of non-empty text entries.

Update request:

- `theme`: optional text or clear value.
- `blocks`: complete replacement schedule or backend-approved patch shape.
- The frontend can work with complete replacement if that matches existing backend patterns.

Whole-week copy request:

- Destination `weekStartDate`.
- Destination `classIds` list or one destination class ID.
- Optional destination theme behavior, such as preserve source theme or override theme. Backend should confirm preferred behavior.

Active lookup request:

- `classId`.
- `weekStartDate`.

### Response Shapes

Weekly Plan response should include:

- `id`.
- `campusId` if normally exposed for campus-scoped resources.
- `classId`.
- `class` display snapshot or enough related fields to show class name and context.
- `weekStartDate`.
- `theme` nullable or absent when not set.
- `blocks` grouped by day or as a flat list with `dayOfWeek`.
- Each block's `startTime`, `endTime`, and ordered `activities`.
- `isArchived` or equivalent status.
- `createdAt`.
- `updatedAt`.

Batch create/copy response should let the frontend distinguish:

- Created plans.
- Skipped/conflicting classes.
- Human-readable or machine-readable conflict reasons.

Active lookup response should let the frontend distinguish:

- Found active plan.
- No active plan for that class/week.
- Class not found or not in active campus.
- Permission/campus access failure.

### Error States The Frontend Needs To Handle

- Validation error for malformed payload.
- Non-Monday week start.
- Invalid class ID.
- Class outside active campus.
- Duplicate active plan for class/week.
- Overlapping time blocks.
- Empty or invalid activities.
- Plan not found.
- Plan archived when attempting an active-only operation.
- Restore conflict because another active plan exists.
- Permission denied.
- Partial batch conflict.

### Loading, Empty, Success, Failure Cases

The frontend will show:

- Loading table/list while `GET /weekly-plans` is pending.
- Empty table state when the list is empty.
- Empty active lookup state when no active plan exists for a class/week.
- Success toast and cache refresh after create/update/copy/archive/restore.
- Inline form errors for validation issues.
- Conflict message naming the affected class/week when possible.
- Partial success summary for batch flows if backend supports partial success.

## 5. Data Requirements

### Required Fields For UI

- `id`.
- `classId`.
- Class display name or equivalent display context.
- `weekStartDate`.
- Schedule blocks.
- For each block: `dayOfWeek`, `startTime`, `endTime`, `activities`.
- Active/archive status.

### Optional Fields For UI

- `theme`.
- Grade or school-year context for class display, if available.
- Created/updated timestamps for table metadata.
- Created/updated user information if already standard for similar resources.

### Filtering, Sorting, Pagination

Needed by frontend:

- Pagination for the management table.
- Sort by week start and update/create timestamp if available.
- Filter by class.
- Filter by week or week date range.
- Filter by archive status.
- Possibly local text search by class/theme/week if backend search is not available.

### Permissions And Status Logic

Frontend expects dedicated permissions for:

- List Weekly Plans.
- Read Weekly Plans.
- Create Weekly Plans.
- Update Weekly Plans.
- Archive/delete Weekly Plans.
- Restore Weekly Plans, either under update/delete permission or a dedicated permission if backend conventions prefer that.

Status logic expected by frontend:

- Active plans participate in class/week uniqueness.
- Archived plans do not block new active plans for the same class/week.
- Restoring an archived plan can fail if another active plan now exists for that same class/week.

## 6. Questions For Backend

Please research and confirm:

- What route naming should be used: `weekly-plans`, `daily-schedules`, or another domain term?
- Should create be batch-capable, or should frontend call a single-create endpoint repeatedly?
- If batch create/copy is supported, should it be all-or-nothing or partial success with per-class conflicts?
- What is the preferred time representation for `startTime` and `endTime`?
- Should blocks be persisted as a flat list or grouped by day in API responses?
- Should activities be stored as an ordered array on a block or as child records?
- Should update replace the full schedule or support granular block patches?
- Should backend provide a dedicated day-copy endpoint, or should day copy stay frontend-local plus normal update?
- What maximum lengths should apply to `theme` and each activity?
- Are Saturday/Sunday schedules allowed, or should the backend restrict to operating days?
- Should empty days be represented explicitly, or omitted from the response?
- What exact permission names should be seeded?
- Should archive use `DELETE` semantics or an explicit archive route according to backend conventions?
- Should active lookup return a null plan when no schedule exists, or use a 404 response?
- Are there existing audit-log conventions this feature should follow?

## 7. Risks And Dependencies

### Frontend Dependencies On Backend Decisions

- API route names and response wrappers affect service/hook implementation.
- Batch behavior affects create/copy UI and conflict handling.
- Time format affects form controls, validation, sorting, and display formatting.
- Full replacement versus granular patch affects editor save behavior.
- Activity storage/response shape affects the editor data model.
- Permission names affect nav/action visibility and error handling.
- Active lookup behavior affects day/week route loading and empty states.

### Technical Debt Or Migration Concerns To Investigate

- New persistence model and migration for Weekly Plans.
- Database-level uniqueness for active campus/class/week.
- Whether partial unique constraints are already the preferred pattern for archived records.
- Whether schedule block overlap can or should be enforced only in domain/application logic.
- Whether batch creation/copy should be transactional.
- Whether archiving should retain historical plans indefinitely.

### Things That Could Change Frontend Implementation

- Backend chooses all-or-nothing batch behavior instead of partial success.
- Backend exposes grouped-by-day response instead of flat blocks, or vice versa.
- Backend requires per-block IDs for editing rather than full schedule replacement.
- Backend restricts schedules to configured operating days.
- Backend adds draft/published states, which are out of scope for the current frontend spec.
- Backend chooses a different domain name than Weekly Plan.

## 8. Acceptance Criteria From Frontend Perspective

Backend work unblocks frontend implementation when:

- Frontend can list Weekly Plans for the active campus with pagination and relevant filters.
- Frontend can fetch one plan by ID.
- Frontend can fetch or resolve the active plan for a class/week, including the no-plan case.
- Frontend can create independent plans for one or more selected classes.
- Backend prevents duplicate active plans for the same campus/class/week.
- Backend validates Monday `weekStartDate`.
- Backend validates strict time block rules and returns actionable validation errors.
- Backend preserves multiple ordered activities per block.
- Frontend can update one plan without affecting any other plan.
- Frontend can copy a whole week to another class/week or multiple destinations.
- Frontend can archive and restore plans with correct conflict behavior.
- Backend enforces campus isolation and class ownership.
- Backend enforces Weekly Plan permissions.
- API responses include the fields needed for table rows, day view, week view, editor hydration, and conflict messages.

Frontend can verify backend completion by:

- Creating a plan for one class and seeing it returned in list/detail/active lookup.
- Creating plans for multiple classes and confirming they are independent records.
- Editing one plan and confirming the other batch-created plans do not change.
- Attempting duplicate create and receiving a conflict.
- Submitting invalid overlapping blocks and receiving validation errors.
- Saving multiple activities in one block and confirming order is preserved.
- Copying a week to another week/class and confirming duplicate handling.
- Archiving a plan and confirming it no longer appears as active.
- Restoring an archived plan and confirming conflicts are enforced.
- Attempting cross-campus class access and receiving an authorization or validation failure.
