---
title: Student Attendance Backend V1
description: Specification for Student Attendance Backend V1 classroom roll-call, approved absence integration, teacher/assistant authorization, legacy status mapping, and attendance update timeline.
createdAt: '2026-07-05T22:28:38.448Z'
updatedAt: '2026-07-14T00:02:37.542Z'
tags:
  - spec
  - approved
  - student-attendance
  - attendance
  - backend
  - api
---

## Overview

Student Attendance Backend V1 provides a classroom roll-call API for teachers and teaching assistants to load a class roster for a selected date, see attendance/absence context, and save attendance rows. The feature preserves the legacy attendance categories used by the school while integrating approved absence requests and update history.

Supporting context:
- @doc/archive/frontend-handoff/student-attendance-backend-handoff
- @doc/architecture/attendance-system
- @doc/specs/2026-06-26/parent-request-center-absence-requests-backend

## Locked Decisions

- D1: Approved absence requests are derived for display before attendance is saved, and are persisted as attendance when staff saves the sheet.
- D2: Staff assigned to the selected class as `HOMEROOM` or `ASSISTANT` may save attendance for that class. A global administrator with a globally assigned role where `isSystemRole = true` may also save without a staff profile or class-staff assignment.
- D3: `N Not identified` is a derived state only. It is not persisted as an attendance row.
- D4: Staff may override a student with an approved absence request to another attendance state, but must provide a note when doing so.
- D5: Attendance updates require a separate update timeline/log. Timestamps must not be appended into the free-text note.
- D6: The update timeline records status changes, note changes, and approved-absence overrides; it does not record no-op saves.
- D7: Staff may save a sheet while some students remain `N Not identified`; those students remain without attendance rows.
- D8: V1 exposes only the four legacy roll-call states: `IN_CLASS`, `ABSENCE_WITH_REQUEST`, `ABSENCE_WITHOUT_REQUEST`, and `NOT_IDENTIFIED`. `LATE` and `LEFT_EARLY` are not exposed in V1.
- D9: Persisted `ABSENCE_WITH_REQUEST` attendance must reference the approved `absenceRequestId` used to justify the absence.
- D10: If an absence request is approved after attendance was already saved, the backend must not automatically mutate the existing attendance row; load responses should surface absence context/warning for staff review.
- D11: When staff saves the sheet, derived `ABSENCE_WITH_REQUEST` rows are persisted as `EXCUSED + absenceRequestId` even if the staff did not manually edit those rows.
- D12: `absenceRequestId` must be stored directly on `StudentAttendanceSummary` as a nullable relation to `AbsenceRequest`, because the saved `EXCUSED` row must be traceable to the approved request used as evidence.
- D13: Attendance update timeline entries must be stored in a dedicated change-log table, separate from the existing `StudentAttendanceLog` check-in/check-out event table.
- D14: The four legacy roll-call states are API/read-model states, not database statuses. Persistence continues to use attendance statuses such as `PRESENT`, `ABSENT`, and `EXCUSED`, while `NOT_IDENTIFIED` remains the absence of a row.

## Requirements

### Functional Requirements

- FR-1: The backend must provide a campus-scoped class/date roll-call read API that returns one row per student active in the selected class on the selected date.
- FR-2: Each roll-call row must include student display fields, selected class/date context, an existing attendance record when present, approved absence context when applicable, a derived V1 roll-call state, and update metadata when available.
- FR-3: The roll-call read API must derive `NOT_IDENTIFIED` when a roster student has no attendance row and no approved absence request for the selected date.
- FR-4: The roll-call read API must derive `ABSENCE_WITH_REQUEST` when a roster student has an approved absence request for the selected date and no conflicting saved attendance row.
- FR-5: Existing saved attendance rows must take precedence over derived absence display, but the response must still surface approved absence context when one exists for the selected date.
- FR-6: The backend must support saving a class/date attendance sheet with rows using V1 states: `IN_CLASS`, `ABSENCE_WITH_REQUEST`, and `ABSENCE_WITHOUT_REQUEST`.
- FR-7: `NOT_IDENTIFIED` rows must not be persisted. If submitted, the backend must either ignore them as unchanged or reject them with a stable validation reason; the chosen behavior must be documented in the API contract.
- FR-8: Saving `IN_CLASS` must persist to the existing attendance status `PRESENT`.
- FR-9: Saving `ABSENCE_WITHOUT_REQUEST` must persist to the existing attendance status `ABSENT`.
- FR-10: Saving `ABSENCE_WITH_REQUEST` must persist to the existing attendance status `EXCUSED` and must store the approved `absenceRequestId` on the saved attendance summary.
- FR-11: When staff saves the sheet, derived `ABSENCE_WITH_REQUEST` rows included in the sheet must be persisted even if the staff did not manually modify those rows.
- FR-12: Staff may save a partial sheet. Students left as `NOT_IDENTIFIED` remain without attendance rows and must still load as `NOT_IDENTIFIED` later unless attendance or approved absence context changes.
- FR-13: If staff overrides an approved absence row to `IN_CLASS` or `ABSENCE_WITHOUT_REQUEST`, the request must include a note; otherwise the backend must reject that row with a stable validation reason.
- FR-14: The save API must support creating new attendance rows and updating existing attendance rows in one class/date workflow.
- FR-15: The save API must return row-level results for saved, skipped, validation, stale/conflict, and permission-denied rows using stable machine-readable reason codes.
- FR-16: Save access requires either a global administrator identified by a globally assigned role where `isSystemRole = true`, or a staff member assigned to the class as `HOMEROOM` or `ASSISTANT`. Campus-level attendance permission alone is not sufficient for non-global-admin staff.
- FR-17: Read access must remain campus-scoped and must enforce existing authentication/campus access/RBAC patterns.
- FR-18: Attendance updates must produce entries in a dedicated attendance change-log table when status, note, or approved-absence override state changes.
- FR-19: Timeline entries must include at minimum attendance id, change type, previous value, new value, actor id, timestamp, and optional note context when applicable.
- FR-20: The attendance response must expose `updatedAt` and enough actor/update history data for the frontend to show when a row was last updated and inspect its timeline.
- FR-21: If an absence request is approved after attendance was already saved, the backend must not mutate the attendance row automatically; the next roll-call read must expose approved absence context so staff can decide whether to update attendance.
- FR-22: Date inputs must be strict date-only `YYYY-MM-DD` values and normalized using the repository's UTC date-only convention.
- FR-23: Persistence must not add database statuses for `IN_CLASS`, `ABSENCE_WITH_REQUEST`, `ABSENCE_WITHOUT_REQUEST`, or `NOT_IDENTIFIED`; those values are API/read-model states derived from saved attendance, approved absence context, and roster membership.

### Non-Functional Requirements

- NFR-1: The daily roll-call read must avoid per-student N+1 database queries for class roster, attendance rows, and approved absence context.
- NFR-2: Save operations must be idempotent for unchanged rows and must not create duplicate student/date attendance rows.
- NFR-3: Authorization failures must not leak cross-campus class, student, or attendance existence.
- NFR-4: The API must preserve existing attendance endpoints where possible or provide compatibility notes for any changed contract.
- NFR-5: The implementation must include focused backend tests for derivation, save behavior, authorization, absence integration, conflict handling, and timeline creation.

## Acceptance Criteria

- [ ] AC-1: Loading a class/date with active students and no attendance returns every active student with derived `NOT_IDENTIFIED`.
- [ ] AC-2: Loading a class/date where a student has an approved absence request returns that student in the roster with derived `ABSENCE_WITH_REQUEST` and absence context.
- [ ] AC-3: Loading a class/date where attendance already exists returns the saved attendance state and still includes approved absence context when applicable.
- [ ] AC-4: Saving `IN_CLASS` creates or updates a row as `PRESENT`.
- [ ] AC-5: Saving `ABSENCE_WITHOUT_REQUEST` creates or updates a row as `ABSENT`.
- [ ] AC-6: Saving `ABSENCE_WITH_REQUEST` creates or updates a row as `EXCUSED` and persists the approved `absenceRequestId`.
- [ ] AC-7: Saving a sheet containing derived `ABSENCE_WITH_REQUEST` rows persists those rows even when they were not manually edited.
- [ ] AC-8: Saving while some students remain `NOT_IDENTIFIED` succeeds and does not persist rows for those students.
- [ ] AC-9: Overriding an approved absence row to a non-`ABSENCE_WITH_REQUEST` state without a note fails for that row with a stable validation reason.
- [ ] AC-10: Overriding an approved absence row with a note succeeds and creates an update timeline entry marking the override.
- [ ] AC-11: A non-global-admin staff member not assigned to the class as `HOMEROOM` or `ASSISTANT` cannot save attendance for that class even if authenticated in the campus.
- [ ] AC-12: A class `HOMEROOM` or `ASSISTANT` can save attendance for that class when campus access and required attendance permissions are satisfied.
- [ ] AC-20: A global administrator with a globally assigned role where `isSystemRole = true` can save attendance without a campus staff profile or class-staff assignment; a role name alone never grants this bypass.
- [ ] AC-13: Status changes and note changes create timeline entries with actor and timestamp; no-op saves do not create timeline entries.
- [ ] AC-14: If an absence request is approved after attendance was already saved, reloading the roster does not mutate the saved attendance but exposes absence context/warning.
- [ ] AC-15: Date validation rejects invalid formats and invalid dates, and accepted dates are normalized to UTC date-only values.
- [ ] AC-16: Backend tests cover the status mapping table: `IN_CLASS -> PRESENT`, `ABSENCE_WITH_REQUEST -> EXCUSED`, `ABSENCE_WITHOUT_REQUEST -> ABSENT`, `NOT_IDENTIFIED -> no row`.
- [ ] AC-17: Prisma schema and migration add nullable `absenceRequestId`/`absence_request_id` to `StudentAttendanceSummary`, with relation to `AbsenceRequest` and an index.
- [ ] AC-18: Prisma schema and migration add a dedicated `StudentAttendanceChangeLog` table for status/note/absence-override timeline entries, separate from `StudentAttendanceLog`.
- [ ] AC-19: No new database statuses are added for the legacy roll-call labels; V1 roll-call labels remain API/read-model states.

## Scenarios

### Scenario 1: Load Empty Roll-Call Sheet

**Given** a teacher is assigned as `HOMEROOM` to a class and the class has active students on `2026-07-06`
**When** the teacher loads the class roll-call sheet for `2026-07-06`
**Then** the backend returns every active student in the class
**And** students without saved attendance or approved absence context are marked `NOT_IDENTIFIED`.

### Scenario 2: Approved Absence Appears In Roster

**Given** a student is active in the selected class on the selected date
**And** the student has an approved absence request overlapping that date
**When** staff loads the roll-call sheet
**Then** the student still appears in the roster
**And** the row is marked `ABSENCE_WITH_REQUEST`
**And** the row includes approved absence context and `absenceRequestId`.

### Scenario 3: Save Sheet With Mixed States

**Given** a class roll-call sheet has one `IN_CLASS` student, one `ABSENCE_WITH_REQUEST` student, one `ABSENCE_WITHOUT_REQUEST` student, and one `NOT_IDENTIFIED` student
**When** an assigned `HOMEROOM` or `ASSISTANT` saves the sheet
**Then** the backend persists `PRESENT`, `EXCUSED + absenceRequestId`, and `ABSENT` rows
**And** the `NOT_IDENTIFIED` student remains without an attendance row.

### Scenario 4: Override Approved Absence Requires Note

**Given** a student has an approved absence request for the selected date
**When** assigned staff changes that row from `ABSENCE_WITH_REQUEST` to `IN_CLASS` without a note
**Then** the backend rejects that row with a stable validation reason
**When** staff retries with a note
**Then** the backend saves the row and records a timeline entry for the override.

### Scenario 5: Unauthorized Staff Cannot Save

**Given** an authenticated non-global-admin campus staff member is not assigned to the selected class as `HOMEROOM` or `ASSISTANT`
**When** that staff member attempts to save attendance for the class
**Then** the backend rejects the save without changing attendance rows.

### Scenario 6: Late Approved Absence Does Not Mutate Saved Attendance

**Given** a student was saved as `IN_CLASS` for a selected date
**And** an absence request for that date is approved later
**When** staff reloads the roll-call sheet
**Then** the saved `IN_CLASS` attendance remains unchanged
**And** the response includes approved absence context/warning for staff review.

### Scenario 7: Global Administrator Saves Without Class Assignment

**Given** an authenticated user has a globally assigned role where `isSystemRole = true`
**And** the user has no campus staff profile or class-staff assignment for the selected class
**When** the global administrator saves attendance for the class
**Then** the backend accepts the save while retaining the normal class/campus existence checks and actor audit identity.

## Technical Notes

- Add nullable `absenceRequestId` on `StudentAttendanceSummary`, mapped to `absence_request_id`, with a relation to `AbsenceRequest` and an index on `absenceRequestId`. This is required because persisted `ABSENCE_WITH_REQUEST` rows must remain traceable to the approved absence request used as evidence.
- Prefer `onDelete: Restrict` for the `StudentAttendanceSummary.absenceRequest` relation so an approved absence request cannot be deleted while attendance rows depend on it. If product later requires deletion, use an explicit archival/supersession flow instead of losing the reference.
- Add a dedicated `StudentAttendanceChangeLog` model for update timeline entries. Do not reuse `StudentAttendanceLog` because that table represents check-in/check-out events and is used for cached attendance time fields.
- `StudentAttendanceChangeLog` should include at minimum: `id`, `attendanceSummaryId`, `changeType`, `previousValue`, `newValue`, `actorId`, optional `note`, and `createdAt`. `previousValue` and `newValue` may be JSON to support status, note, and absence override changes without schema churn.
- Keep `StudentAttendanceLog` focused on attendance event logs such as `CHECK_IN` and `CHECK_OUT`; timeline status/note changes must not affect `firstCheckinAt`, `lastCheckoutAt`, or `totalMinutesPresent` calculations.
- Existing attendance status enum already has `PRESENT`, `ABSENT`, and `EXCUSED`; V1 should expose a separate API-level roll-call state so legacy UI labels are not coupled to persistence enum names.
- Do not add database statuses for `IN_CLASS`, `ABSENCE_WITH_REQUEST`, `ABSENCE_WITHOUT_REQUEST`, or `NOT_IDENTIFIED`. `IN_CLASS` maps to `PRESENT`, `ABSENCE_WITH_REQUEST` maps to `EXCUSED + absenceRequestId`, `ABSENCE_WITHOUT_REQUEST` maps to `ABSENT`, and `NOT_IDENTIFIED` maps to no attendance row.
- Existing class staff roles include `HOMEROOM` and `ASSISTANT`; the save path must verify the current user is linked to a staff record assigned to the selected class with one of those roles, unless the user is a global administrator identified by a globally assigned role where `isSystemRole = true`.
- Existing absence requests support `APPROVED`; roll-call read should query approved overlapping absence requests for the selected date.
- Existing date-only conventions in the repo prefer UTC date-only normalization. Avoid server-local `new Date(date)` drift for date-only payloads.
- This spec does not include parent notifications, attendance reports, late/early status UI, or automatic mutation of attendance when absence requests are approved.

## Task Links

Generated tasks will be linked here after `/kn-plan --from @doc/specs/2026-07-06/student-attendance-backend-v1` runs.

## Open Questions

- [ ] Should `NOT_IDENTIFIED` rows submitted in a save payload be ignored as unchanged or rejected with a validation reason? The spec allows either but requires the final API contract to document one behavior.
- [ ] Should read access be limited to assigned `HOMEROOM`/`ASSISTANT`, or can other campus roles with `attendance.list/read` load sheets read-only? D2 locks save permission only.
