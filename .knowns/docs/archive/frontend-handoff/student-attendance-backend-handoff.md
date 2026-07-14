---
title: Student Attendance Backend Handoff
description: Frontend-to-backend handoff for Student Attendance V1, updated after integration review with confirmed roll-call support and follow-up API requirements for timeline actor display and scalable class selection.
createdAt: '2026-07-05T22:02:18.113Z'
updatedAt: '2026-07-12T15:10:04.038Z'
tags:
  - frontend-handoff
  - backend
  - frontend
  - attendance
  - student-attendance
  - roll-call
  - api
  - api-needed
  - follow-up
---

# Student Attendance Backend Handoff

## Purpose

This document is a frontend-to-backend handoff for the planned Student Attendance V1 feature. It is meant to help the backend dev quickly understand what the frontend is planning to build, what backend support may be needed, and what questions or risks should be researched in the backend codebase.

This handoff intentionally avoids backend implementation guidance. Endpoint names and field lists below are frontend-facing proposals only; backend should confirm, adjust, or replace them based on the existing backend architecture.

## 1. Feature Summary

### What We Are Building

Student Attendance is a staff-facing daily attendance workspace for recording and reviewing student attendance by class and date.

The frontend V1 is expected to focus on a classroom roll-call workflow:

- Staff opens the Attendance page from the dashboard.
- Staff selects a date, defaulting to today.
- Staff selects a class.
- Frontend loads the class roster and any attendance records already recorded for that class/date.
- Staff marks students as present, absent, late, excused, or left early.
- Staff optionally adds check-in/check-out times and notes where the UI allows it.
- Staff saves the class attendance sheet.
- Frontend shows success, skipped/conflict rows, or validation/error states clearly.

### Why We Are Building It

The school needs a fast operational workflow for staff to record daily student attendance. This should reduce manual tracking outside the system and create attendance data that can later support parent communication, reports, student history, and operational review.

### Main Frontend User Flow

1. Staff navigates to the Student Attendance page.
2. Frontend checks current campus and attendance permissions.
3. Staff chooses a date and class.
4. Frontend loads active students for that class plus existing attendance records for that date.
5. Staff marks one or more attendance statuses.
6. Staff saves the sheet.
7. Frontend refreshes the attendance data and shows any row-level skipped/conflict results.

## 2. Frontend Spec Summary

### Screens And Components Involved

Planned frontend surface:

- Dashboard route for Student Attendance, likely under staff dashboard navigation.
- Page header using the existing list-page header pattern.
- Date selector, defaulting to today.
- Class selector using the current campus-scoped class list pattern.
- Daily class attendance roster/table.
- Row controls for attendance status.
- Optional row-level note and time controls, depending on final backend contract.
- Bulk action controls such as mark all present or clear unsaved changes.
- Save action with loading, success, partial success, and failure states.
- Optional detail view for an existing attendance record if logs/history are exposed in V1.

Existing frontend patterns likely to be reused:

- Campus context and `X-Campus-Id` header injection.
- React Query service/hook/query-key feature structure.
- Class list and class enrollment hooks for selecting a class and loading roster data.
- Permission gating with `hasPermission("attendance", action)`.
- Date-only handling similar to absence requests and health center daily views.

### Important UI States

The frontend expects to handle these states:

- Campus context loading.
- No campus selected or no campus access.
- Permission denied for listing attendance.
- Permission denied for creating/updating attendance, resulting in read-only UI.
- No class selected.
- No classes available in the current campus.
- Class selected but no active students in the roster.
- Attendance not yet recorded for the selected class/date.
- Attendance partially recorded for the selected class/date.
- Attendance fully recorded for the selected class/date.
- Save in progress.
- Save succeeded.
- Save partially succeeded with skipped rows.
- Save failed due to validation, permissions, conflict, network, or unexpected backend error.
- Stale data or conflict when another staff member has already recorded a row.

### User Actions We Need To Support

Frontend V1 needs to support:

- Select attendance date.
- Select class.
- View active class roster for that date.
- View existing attendance statuses for that class/date.
- Mark a single student status.
- Mark all eligible unrecorded students as present.
- Edit status for an existing attendance record if allowed.
- Add or clear a note where allowed.
- Add check-in/check-out times if V1 includes time tracking controls.
- Save a full class sheet or selected changed rows.
- Recover from partial success by showing which rows were skipped and why.
- Refresh/reload the selected class/date.

### Frontend Validation Or Business Rules Assumed

These are frontend-side assumptions that backend should confirm:

- Date is required.
- Class is required.
- Each submitted row must have a student and status.
- Status values available to the UI are: `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`, `LEFT_EARLY`.
- Notes are optional but should have a backend-confirmed max length.
- If check-in/check-out fields are supported, check-out should be after check-in.
- Date-only values should be sent as `YYYY-MM-DD`.
- Timestamps, if used, should follow the same timezone/date normalization rules as other backend date/time APIs.
- Frontend should not assume approval of an absence request automatically creates or updates attendance unless backend explicitly confirms that behavior.

## 3. Backend Needs And Frontend Assumptions

### Data The Frontend Needs

For the daily class attendance workspace, frontend needs:

- Current campus context is honored through the standard campus header.
- A list of classes available in the current campus.
- Active roster for a selected class/date.
- Attendance records for a selected class/date.
- A stable identifier for each attendance record when it already exists.
- Student display fields for each roster row.
- Attendance status and optional time/note/log fields for each existing record.
- Row-level save result data for partial success.
- Permission information already available through the current role/permission model.

### Actions The Frontend Needs To Perform

Frontend needs backend support for:

- Read class attendance for one date.
- Record attendance for multiple students in one class/date workflow.
- Update existing attendance rows.
- Read one attendance record if a detail view is supported.
- Read student attendance history if a student profile/history extension is included later.

### Existing APIs We Think May Be Reusable

Based on frontend research and existing backend-facing contracts, these may already exist or be close to reusable:

| Frontend need | Existing surface frontend believes may exist | Notes |
| --- | --- | --- |
| List classes | Class list endpoint | Already used by class, meal menu, weekly plan, and health center screens. |
| Load class roster | Class enrollments endpoint | Frontend can use active enrollments as the roster if backend confirms date semantics. |
| Read class attendance | Attendance class/date endpoint | Frontend needs to confirm whether it returns only recorded rows or a full roster. |
| Create attendance | Attendance create/bulk endpoint | Frontend needs row-level skipped/conflict results for class sheet save. |
| Update attendance | Attendance update endpoint | Frontend needs update behavior for already-recorded rows. |
| Permissions | `attendance.*` permissions | Frontend can gate UI, but backend must enforce permissions server-side. |

### New Or Changed APIs We May Need

Frontend can probably build V1 from separate roster and attendance endpoints, but the cleanest frontend workflow would be a backend-confirmed daily roster response that combines active roster and attendance state.

Potential backend support options:

| Option | Frontend impact | Backend decision needed |
| --- | --- | --- |
| Reuse separate class roster and attendance endpoints | Frontend overlays attendance by student id. More client logic and more race/conflict handling. | Confirm date semantics and conflict behavior. |
| Add a daily class attendance roster endpoint | Simplest frontend state model and easiest loading/empty handling. | Decide response shape and whether unrecorded students are included. |
| Add an upsert/batch save endpoint | One save action can create new rows and update existing rows consistently. | Decide if this fits backend domain rules. |
| Keep create-only bulk plus update-by-id | Frontend must split changed rows into creates and updates. | Confirm partial success and conflict responses. |

### Backend Behavior We Are Assuming But Have Not Confirmed

These are not backend requirements yet; they are items the backend dev should verify:

- Attendance is campus-scoped and requires the standard campus header.
- Class attendance read should be limited to the selected campus.
- Student attendance can only be recorded for students who belong to the current campus.
- Student attendance should ideally be tied to the student's class enrollment for the selected date.
- One student can have at most one attendance summary per date.
- Partial success is possible for bulk attendance saves.
- Existing attendance permissions should be enforced on all attendance routes.
- Existing absence request approval does not automatically mutate attendance in V1 unless backend decides otherwise.

## 4. Suggested API Contract

This section describes a frontend-friendly API contract. It is intentionally proposed, not prescribed. Backend should decide whether to reuse existing endpoints, adapt them, or create a new aggregate endpoint.

### Endpoint: Load Daily Class Attendance

Purpose: load all rows the frontend should show for one class/date.

Proposed request:

| Field | Location | Required | Notes |
| --- | --- | --- | --- |
| `classId` | path or query | Yes | Selected class. |
| `date` | query | Yes | Date-only, `YYYY-MM-DD`. |
| `X-Campus-Id` | header | Yes | Current staff campus. |

Frontend-preferred response shape:

| Field | Required | Notes |
| --- | --- | --- |
| `campusId` | Yes | Current campus id. |
| `class` | Yes | Class id/name and optional grade/school-year display context. |
| `date` | Yes | Date-only or canonical date anchor. |
| `rows` | Yes | One row per active student expected in the roster. |
| `summary` | Optional | Counts by status and recorded/unrecorded totals. |

Each row should include:

| Field | Required | Notes |
| --- | --- | --- |
| `student` | Yes | Student id, full name, student code, optional nickname/avatar. |
| `attendance` | Optional | Null/absent when no attendance has been recorded. |
| `attendance.id` | Required if attendance exists | Needed for update actions. |
| `attendance.status` | Required if attendance exists | UI status value. |
| `attendance.firstCheckinAt` | Optional | Display/edit depending on V1 scope. |
| `attendance.lastCheckoutAt` | Optional | Display/edit depending on V1 scope. |
| `attendance.totalMinutesPresent` | Optional | Display only. |
| `attendance.note` | Optional | Row note. |
| `attendance.updatedAt` | Optional | Useful for stale/conflict messaging. |
| `absenceContext` | Optional | Approved/pending absence information if backend wants attendance UI to surface it. |

If backend keeps existing recorded-row-only class attendance, frontend can still work but will need a separate active roster read and a merge step.

### Endpoint: Save Daily Class Attendance

Purpose: let staff save attendance changes from one class/date sheet.

Proposed request fields:

| Field | Required | Notes |
| --- | --- | --- |
| `classId` | Yes | Selected class. |
| `date` | Yes | Date-only, `YYYY-MM-DD`. |
| `records` | Yes | Changed or full submitted rows, depending on backend preference. |

Each record field:

| Field | Required | Notes |
| --- | --- | --- |
| `studentId` | Yes | Student being marked. |
| `attendanceId` | Optional | Present when updating an existing row. |
| `status` | Yes | One of the supported attendance statuses. |
| `checkinAt` | Optional | Timestamp if time tracking is included. |
| `checkoutAt` | Optional | Timestamp if time tracking is included. |
| `note` | Optional | Row-level note. |

Frontend-preferred response fields:

| Field | Required | Notes |
| --- | --- | --- |
| `saved` or `created`/`updated` | Yes | Rows persisted by backend. |
| `skipped` | Yes | Empty array when none skipped. |
| `summary` | Optional | Updated count summary for the class/date. |

Each skipped row should include:

| Field | Required | Notes |
| --- | --- | --- |
| `studentId` | Yes | Lets frontend map the issue to a row. |
| `reason` | Yes | Stable machine-readable reason preferred. |
| `message` | Optional | Human-readable message if backend provides one. |

Stable skipped/conflict reasons frontend can handle well:

- Student not found.
- Student not in campus.
- Student not active in class on selected date.
- Attendance already exists for this student/date.
- Attendance record not found for update.
- Attendance record belongs to another campus/class/date.
- Invalid status.
- Invalid time range.
- Permission denied.

### Endpoint: Read Attendance Detail

Purpose: optional V1 detail view for logs/history behind one attendance row.

Required frontend fields:

- Attendance summary id.
- Student summary.
- Class summary.
- Date.
- Status.
- Check-in/check-out summary fields.
- Note.
- Optional logs ordered chronologically.

### Endpoint: Student Attendance History

Purpose: optional later extension for student profile/history.

Required query fields:

- `studentId`.
- `startDate`.
- `endDate`.
- Campus header.

Response can be a list of attendance summaries ordered by date.

### Error States The Frontend Needs To Handle

Frontend needs clear status codes and, where possible, stable error codes or reason values for:

- Missing campus context.
- Campus access denied.
- Missing permission.
- Class not found.
- Student not found.
- Student not in selected campus.
- Student not active in selected class/date.
- Duplicate attendance for student/date.
- Attempt to update an attendance row that no longer exists.
- Invalid date.
- Invalid status.
- Invalid check-in/check-out time relationship.
- Validation failures for note length or payload shape.
- Generic server failure.

### Loading, Empty, Success, Failure Cases

Frontend needs backend behavior that supports:

- Loading class/date attendance without creating records.
- Empty roster state when the class has no active students.
- Unrecorded state when roster exists but no attendance has been saved.
- Partial recorded state when only some students have attendance.
- Full recorded state when every active student has a status.
- Full save success.
- Partial save success with row-level skipped data.
- Complete save failure without ambiguous row state.

## 5. Data Requirements

### Fields Needed By The UI

Class selection:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Class id. |
| `name` | Yes | Display label. |
| `gradeLevel.name` | Optional | Useful disambiguator. |
| `schoolYear.name` | Optional | Useful disambiguator. |
| `studentCount` | Optional | Useful for picker context. |

Roster student row:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Student id. |
| `fullName` | Yes | Main display. |
| `studentCode` | Optional | Disambiguation. |
| `nickname` | Optional | Secondary display. |
| `avatarUrl` | Optional | Nice-to-have if available. |
| `currentClass` or selected class relation | Optional | Only needed if response is not class-scoped. |

Attendance row:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Required for existing records | Needed for update. |
| `studentId` | Yes | Merge key. |
| `classId` | Yes | Confirm selected class. |
| `campusId` | Yes | Confirm selected campus. |
| `date` | Yes | Selected date anchor. |
| `status` | Yes | Main editable value. |
| `firstCheckinAt` | Optional | Time display/edit. |
| `lastCheckoutAt` | Optional | Time display/edit. |
| `totalMinutesPresent` | Optional | Display/reporting value. |
| `note` | Optional | Staff note. |
| `logs` | Optional | Detail/history view only. |
| `createdAt` | Optional | Audit display/stale handling. |
| `updatedAt` | Optional | Audit display/stale handling. |

### Filtering, Sorting, Pagination, Permissions, Status Logic

- Class list should remain campus-scoped.
- Attendance daily class view should not need pagination if it returns one class roster for one date, assuming class sizes remain reasonable.
- If backend expects pagination for very large classes, frontend needs pagination metadata and stable row-level save behavior across pages.
- Student attendance history should support date range filtering and may need pagination if histories can be large.
- Attendance statuses should be stable enum-like values.
- Frontend intends to check `attendance.list` for read access, `attendance.create` for first-time saves, `attendance.update` for edits, and possibly `attendance.read` for detail/history.
- Backend should confirm whether `attendance.delete` has any V1 frontend use. Current frontend V1 does not plan a delete action.

## 6. Questions For Backend

1. Which existing attendance endpoints are current and supported for frontend use?
2. Does the existing class attendance read return only recorded attendance rows, or can it return the full class roster with null attendance for unrecorded students?
3. Should frontend load roster from class enrollments and attendance separately, or should backend provide a combined daily roster endpoint?
4. How should backend define “active student in class on selected date”?
5. Can attendance be recorded for a student who is no longer active in the class today but was active on the selected historical date?
6. Should bulk save be create-only, update-only, or upsert-like from the frontend perspective?
7. If bulk save is create-only, what is the recommended frontend flow for rows that already have attendance?
8. Are row-level partial success results guaranteed for bulk saves?
9. Are skipped reasons stable enough for frontend mapping, or should backend add stable machine-readable codes?
10. Are `PRESENT`, `ABSENT`, `LATE`, `EXCUSED`, and `LEFT_EARLY` the complete V1 status set?
11. Do any statuses require a note or timestamp?
12. What is the expected meaning of check-in/check-out times for `ABSENT` or `EXCUSED` rows?
13. Should the frontend expose check-in/check-out editing in V1, or only status and note?
14. Which timezone policy should the frontend follow for date-only attendance and timestamp fields?
15. Does backend currently enforce `attendance.*` permissions on attendance routes?
16. Should absence requests influence attendance UI or default statuses?
17. Should approved absence requests automatically mark `EXCUSED`, or should attendance remain a separate staff action?
18. Is attendance mutable after initial save? If yes, are there audit/history implications the UI should show?
19. Is deleting attendance supported or intentionally out of scope?
20. Are there migration/backfill concerns for existing attendance data that may affect frontend states?

## 7. Risks And Dependencies

### Frontend Dependencies On Backend Decisions

- Whether a daily roster aggregate endpoint exists affects the frontend data model significantly.
- Whether bulk save is create-only or upsert-like affects save orchestration and error handling.
- Whether attendance routes enforce permissions affects frontend release readiness and security expectations.
- Whether attendance is tied to class enrollment on the selected date affects validation and historical attendance behavior.
- Whether absence requests influence attendance affects UI copy, default status suggestions, and row warnings.
- Timezone normalization affects every date filter and timestamp display.

### Possible Technical Debt Or Migration Concerns

- A recorded-row-only attendance API forces frontend to merge class roster and attendance client-side.
- Client-side merging can drift if roster date semantics differ from attendance date semantics.
- Create-only bulk save can create complex frontend logic for partially recorded sheets.
- Human-readable skipped reasons are harder to map into localized row messages than stable reason codes.
- Missing backend permission enforcement would create a mismatch between frontend-gated UI and actual API access.
- Attendance status updates without clear audit semantics may make future history/reporting screens harder.

### Anything That Could Change Frontend Implementation

- Backend choosing a combined daily roster endpoint would simplify frontend state.
- Backend choosing upsert-style save would simplify the save flow.
- Backend requiring strict check-in/check-out logs would require richer row controls.
- Backend deciding attendance cannot be edited after save would change the UI into submit/read-only workflow.
- Backend coupling absence requests to attendance would add absence context and status suggestions.
- Backend requiring pagination for class roster would change the class sheet interaction model.

## 8. Acceptance Criteria From Frontend Perspective

Backend work unblocks frontend implementation when these are true:

1. Frontend can load classes for the current campus.
2. Frontend can load the active roster for one class/date, either directly or via confirmed existing class enrollment semantics.
3. Frontend can load attendance records for one class/date without creating records.
4. Frontend can distinguish unrecorded, partially recorded, and fully recorded class/date states.
5. Frontend can create attendance records for multiple students in one save flow.
6. Frontend can update existing attendance records when the user has permission.
7. Backend returns row-level skipped/conflict results for partial success cases.
8. Backend returns stable enough error information for validation, duplicate, permission, campus, and stale-data states.
9. Backend confirms the supported attendance statuses and timestamp rules.
10. Backend confirms whether absence requests affect attendance in V1.
11. Backend enforces attendance permissions server-side or explicitly documents the temporary gap.
12. Backend response fields include the student/class/attendance fields needed for display and update mapping.
13. Backend date handling is documented clearly enough for frontend to send date-only values and display timestamps correctly.
14. Frontend can verify the flow with one campus, one class, multiple students, and at least one pre-existing attendance row.

Frontend can verify completion by exercising these scenarios against the backend API:

- Load a class/date with no attendance yet and show the full roster.
- Save all students as present and reload the same class/date.
- Change one student from present to late or excused and reload.
- Attempt to save when one row already exists and confirm the backend response is deterministic.
- Attempt access without attendance list/create/update permissions and confirm backend rejects as expected.
- Attempt access with the wrong campus context and confirm backend rejects as expected.
- Load a student attendance date range if history is included in the backend scope.


## 9. Post-integration API Follow-up (2026-07-12)

The implemented frontend and backend roll-call contracts were re-audited after integration.

### Confirmed Complete

- `GET /attendance/class/:classId/roll-call?date=YYYY-MM-DD`
- `POST /attendance/class/:classId/roll-call`
- campus scoping, permission OR semantics, approved absence context, partial saves, mixed row outcomes, reason codes, and refresh-after-save behavior
- targeted backend verification passed: 3 suites and 10 tests

### Remaining Backend-facing Gaps

1. Timeline entries currently expose only `actorId`. Add a human-readable actor summary without removing the existing ID.
2. The frontend currently consumes only the first 50 rows from the general class list. Provide a scalable attendance class-options contract or formally support paginated/searchable reuse of `GET /classes`.

### Canonical Follow-up Contract

See @doc/api/student-attendance-api-follow-up for proposed request/response shapes, authorization rules, implementation guidance, acceptance criteria, and verification requirements.

### Frontend Work Kept Separate

The API follow-up does not cover client-side fixes for:

- preserving failed-row drafts after mixed save results;
- preventing bulk mark-in-class from overwriting explicit local drafts;
- warning before class/date changes discard unsaved work;
- adding automated frontend state tests.
