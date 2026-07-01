---
title: Medication Requests And Administration Backend
description: Specification for the backend Medication Requests and Administration workflow across Parent Request Center, Health Center, and Student Profile Health.
createdAt: '2026-07-01T07:49:47.003Z'
updatedAt: '2026-07-01T07:55:51.823Z'
tags:
  - spec
  - approved
  - medication
  - student-health
  - health-center
  - parent-request-center
  - backend
  - api
---

## Overview

Build backend support for the Medication Requests and Administration workflow. V1 covers parent-submitted medication requests, staff review, materialized daily administration occurrences, staff outcome recording with correction history, medication history for Student Profile Health, and lightweight Health Center summary counts/navigation hints.

This feature is intentionally broader than current `StudentHealthInstruction` support. Existing Student Health instructions can show approved medication visibility, but the Medication domain is the source of truth for request, review, schedule, occurrence, administration log, and correction history.

Source context:

- Frontend handoff file: `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/.knowns/docs/backend-handoff/medication-requests-and-administration-backend-handoff.md`
- @doc/specs/2026-07-01/student-profile-health-tab-backend
- @doc/specs/2026-07-01/health-center-backend-aggregate-api
- @doc/specs/2026-06-28/parent-access-model-and-campus-discovery
- @doc/specs/2026-06-26/parent-request-center-absence-requests-backend

## Locked Decisions

- D1: V1 is the full workflow: parent submit medication request, staff review, approved request creates due administration items, staff records outcomes, and history is visible in request detail plus Student Profile Health.
- D2: Dedicated Medication domain is the source of truth, including medication request, medication item/order, scheduled occurrence, and administration log. `StudentHealthInstruction` is only an optional mirror/visibility surface after approval.
- D3: V1 uses permission-only campus-scoped staff access. Parent actions are guarded by authenticated guardian/student relationship, while staff review/administer actions require active campus access plus dedicated medication permissions. No nurse/teacher role names or class-only teacher restrictions are hardcoded in V1.
- D4: Approval materializes concrete medication administration occurrence rows for each due date/time in the approved date range, and administration logs attach to those occurrence IDs.
- D5: V1 allows correction by permitted staff using append-only history. The occurrence exposes the latest outcome, but previous logs remain visible for audit/history.
- D6: Parents can cancel requests while `SUBMITTED` or `NEEDS_MORE_INFO` and can respond with additional information when staff requests it. Parents cannot edit or cancel after approval/rejection, and full revision of medication details is out of V1.
- D7: V1 defers medication attachments. Medication request APIs do not support upload/linking yet; response attachment fields are omitted or stable empty arrays only if needed for frontend compatibility.
- D8: V1 schedule supports a daily inclusive date range plus one or more `HH:mm` times per day. Backend materializes occurrences for every date/time combination in the approved range.
- D9: Non-given outcomes (`SKIPPED`, `REFUSED`, `ABSENT`) require a note. `GIVEN` note is optional. Any correction requires a correction note.
- D10: V1 does not auto-write missed rows. Backend stores due/recorded state and derives `OVERDUE` for unrecorded occurrences whose due datetime has passed.
- D11: V1 provides dedicated medication request/administration endpoints and extends Health Center with medication counts/navigation hints for pending, due, and overdue items. It does not merge full medication occurrence rows into the existing `/health-center/daily-items` instruction/event arrays.

## API Contract

All routes use the existing backend conventions:

- Base path uses the global `/api` prefix where configured.
- Protected requests require Clerk bearer authentication.
- Campus-scoped staff routes require `X-Campus-Id` and active campus access.
- Parent self-service routes use the authenticated current guardian and selected campus; clients must not send trusted `guardianId` or `userId` values.
- Successful responses use the standard response envelope.
- Validation, authorization, not-found, and conflict errors use existing NestJS/backend error conventions.

### Parent Medication Requests

#### `GET /api/parent/medication-requests`

Lists medication requests submitted by the authenticated current guardian in the selected campus.

Query params:

- `studentId`: optional authorized student UUID filter.
- `status`: optional request status filter.
- `fromDate`: optional date-only lower bound for request date ranges.
- `toDate`: optional date-only upper bound for request date ranges.

Response data: array or paginated list of medication request summaries, following the final implementation convention selected by existing list endpoints.

#### `POST /api/parent/medication-requests`

Creates a medication request for an authorized child.

Request payload:

```json
{
  "studentId": "student_uuid",
  "startDate": "2026-07-01",
  "endDate": "2026-07-05",
  "reason": "Fever after doctor visit",
  "parentNotes": "Call me if vomiting occurs.",
  "items": [
    {
      "medicationName": "Antibiotic syrup",
      "dosage": "5 ml",
      "instructions": "Give after lunch with water.",
      "timesOfDay": ["12:30"],
      "scheduleNotes": "After lunch only.",
      "notes": null
    }
  ]
}
```

Required fields:

- `studentId`
- `startDate`
- `endDate`
- at least one `items` entry
- each item: `medicationName`, `instructions`, and at least one `timesOfDay` value

Optional fields:

- `reason`
- `parentNotes`
- item `dosage`
- item `scheduleNotes`
- item `notes`

#### `GET /api/parent/medication-requests/:requestId`

Returns one guardian-owned medication request detail, including medication items, review state, request timeline, materialized occurrence summary when available, and administration history visible to the parent.

#### `POST /api/parent/medication-requests/:requestId/cancel`

Cancels a guardian-owned request when its status is `SUBMITTED` or `NEEDS_MORE_INFO`.

Request payload:

```json
{
  "reason": "Medication no longer needed."
}
```

#### `POST /api/parent/medication-requests/:requestId/respond`

Adds parent follow-up information when the current request status is `NEEDS_MORE_INFO`.

Request payload:

```json
{
  "message": "Doctor confirmed the lunch dosage should be 5 ml."
}
```

### Staff Medication Requests

#### `GET /api/medication-requests`

Lists campus medication requests for permitted staff.

Required permission: `medication_request.list` or the final equivalent medication list permission.

Recommended query params:

- standard pagination/sort/filter params
- `status`
- `studentId`
- `classId`
- `fromDate`
- `toDate`
- `search`

Default ordering: operationally useful pending/recent order, deterministic for the same campus and filters.

#### `GET /api/medication-requests/:requestId`

Returns staff medication request detail in the selected campus, including student summary, class summary when available, submitter summary, full medication items, review data, parent follow-up entries, occurrence summary, administration logs, and timeline.

Required permission: `medication_request.read`.

#### `POST /api/medication-requests/:requestId/review`

Reviews a submitted request.

Required permission: `medication_request.review` or the final equivalent review permission.

Request payload for approval:

```json
{
  "action": "APPROVE",
  "note": "Approved for this week."
}
```

Request payload for rejection:

```json
{
  "action": "REJECT",
  "note": "Medication must be administered at home."
}
```

Request payload for needs-more-info:

```json
{
  "action": "NEEDS_MORE_INFO",
  "note": "Please confirm dosage after lunch."
}
```

On approval, backend materializes administration occurrence rows for every medication item, date, and time in the approved schedule. If a Student Health instruction mirror is created, it must reference or be traceable to the Medication domain and must not become the source of truth.

### Staff Medication Administration

#### `GET /api/medication-administrations/daily`

Lists medication administration occurrences for the selected campus/date, optionally filtered by class, student, and derived/current status.

Required permission: `medication_administration.read` or the final equivalent read permission.

Query params:

- `date`: optional `YYYY-MM-DD`, default server current date.
- `classId`: optional selected-date class filter.
- `studentId`: optional student filter within campus.
- `status`: optional filter such as `DUE`, `OVERDUE`, `GIVEN`, `SKIPPED`, `REFUSED`, `ABSENT`.
- standard pagination/sort params where practical.

Daily queue item fields:

- `occurrenceId`
- `requestId`
- `medicationItemId`
- `student` summary
- `class` summary when available
- `medicationName`
- `dosage`
- `instructions`
- `dueDate`
- `dueTime`
- `status`
- `isOverdue`
- `parentNotes`
- latest administration log summary when recorded
- timestamps needed for conflict detection

Default ordering: due time ascending, then student display name, then medication item/order.

#### `POST /api/medication-administrations/:occurrenceId/record`

Records or corrects the latest outcome for one occurrence.

Required permission: `medication_administration.record` or the final equivalent record permission.

First record request:

```json
{
  "outcome": "GIVEN",
  "actualTime": "12:35",
  "note": null
}
```

Non-given request:

```json
{
  "outcome": "REFUSED",
  "actualTime": "12:35",
  "note": "Student refused after two attempts."
}
```

Correction request:

```json
{
  "outcome": "GIVEN",
  "actualTime": "12:40",
  "note": "Correcting previous refused entry; medication was administered after parent call.",
  "correctionOfLogId": "previous_log_uuid"
}
```

Rules:

- `outcome` must be one of `GIVEN`, `SKIPPED`, `REFUSED`, `ABSENT`.
- `note` is required for `SKIPPED`, `REFUSED`, and `ABSENT`.
- `note` is required when `correctionOfLogId` is present.
- Corrections append a new log row and update the occurrence latest outcome summary; they never overwrite prior logs.
- Concurrent duplicate records or stale corrections must return a clear conflict response rather than silently overwriting state.

### Student Medication History

#### `GET /api/students/:studentId/medication-history`

Returns medication request and administration history for the selected student in the active campus for Student Profile Health.

Required permission: `medication_request.read` or another final medication history/read permission.

Recommended query params:

- `offset`
- `limit`
- `fromDate`
- `toDate`
- `status`

Response includes request summaries, medication item summaries, occurrence/log history, reviewer/recorder metadata, and timeline entries needed by Student Profile Health.

### Health Center Medication Summary

Extend an existing or new Health Center summary endpoint with medication counts/navigation hints.

Required permission: use medication read permissions plus active campus access.

Minimum response data:

```json
{
  "medication": {
    "pendingRequests": 3,
    "dueToday": 8,
    "overdue": 2,
    "needsMoreInfo": 1,
    "links": {
      "requests": "/health-center/medication-requests",
      "administration": "/health-center/medication-administration"
    }
  }
}
```

Do not merge full medication occurrence rows into the existing `instructions` or `events` arrays from `/api/health-center/daily-items` in V1.

## Data Model Requirements

### Medication Request

Fields:

- `id`: UUID.
- `campusId`: UUID.
- `studentId`: UUID.
- `requesterGuardianId`: UUID.
- `requesterUserId`: UUID nullable.
- `status`: enum.
- `startDate`: date-only.
- `endDate`: date-only.
- `reason`: nullable text.
- `parentNotes`: nullable text.
- `reviewedByUserId`: nullable UUID.
- `reviewedAt`: nullable DateTime.
- `reviewNote`: nullable text.
- `cancelledAt`: nullable DateTime.
- `cancelReason`: nullable text.
- timestamps.

Request statuses:

- `SUBMITTED`
- `NEEDS_MORE_INFO`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `COMPLETED`
- `EXPIRED`

### Medication Item Or Order

Fields:

- `id`: UUID.
- `requestId`: UUID.
- `medicationName`: required text.
- `dosage`: nullable text.
- `instructions`: required text.
- `timesOfDay`: required `HH:mm` array or normalized child rows.
- `scheduleNotes`: nullable text.
- `notes`: nullable text.
- timestamps.

### Administration Occurrence

Fields:

- `id`: UUID.
- `requestId`: UUID.
- `medicationItemId`: UUID.
- `campusId`: UUID.
- `studentId`: UUID.
- `dueDate`: date-only.
- `dueTime`: `HH:mm` or due minute.
- latest outcome summary fields nullable until recorded.
- latest log ID nullable.
- timestamps.

Stored occurrence states should distinguish unrecorded from recorded. `OVERDUE` is derived when due datetime is before current backend time and no latest outcome exists.

### Administration Log

Fields:

- `id`: UUID.
- `occurrenceId`: UUID.
- `outcome`: enum `GIVEN`, `SKIPPED`, `REFUSED`, `ABSENT`.
- `recordedByUserId`: UUID.
- `recordedAt`: DateTime.
- `actualTime`: nullable `HH:mm` or minute.
- `note`: nullable/required by rules.
- `correctionOfLogId`: nullable UUID.
- timestamps.

Logs are append-only for corrections.

### Timeline Entries

Backend may either store explicit request timeline rows or derive timeline from request/review/response/log records. The API must return stable timeline entries with actor, action, timestamp, and note/reason where applicable.

## Requirements

### Functional Requirements

- FR-1: Parent users can list medication requests they submitted for students linked to their current guardian profile in the selected campus.
- FR-2: Parent users can create medication requests only for students linked to their current guardian profile in the selected campus.
- FR-3: Parent request creation validates date range, at least one medication item, required item fields, and at least one `HH:mm` schedule time per item.
- FR-4: Parent users can view detail/history only for their own guardian-owned medication requests.
- FR-5: Parent users can cancel medication requests only while status is `SUBMITTED` or `NEEDS_MORE_INFO`.
- FR-6: Parent users can respond with additional information only while status is `NEEDS_MORE_INFO`.
- FR-7: Staff users can list campus medication requests only with active campus access and medication list/read permission.
- FR-8: Staff users can view campus medication request details only with active campus access and medication read permission.
- FR-9: Staff users can review requests with approve, reject, or needs-more-info actions only with active campus access and medication review permission.
- FR-10: Backend enforces valid request status transitions and rejects stale or invalid transitions.
- FR-11: Approving a request materializes administration occurrence rows for every date/time combination in the inclusive date range for each medication item.
- FR-12: Approved requests expose daily administration occurrences through a staff daily queue filtered by date, class, student, and status.
- FR-13: Staff users can record administration outcomes only with active campus access and medication administration record permission.
- FR-14: Recording non-given outcomes requires a note; recording `GIVEN` accepts an optional note.
- FR-15: Correcting an occurrence appends a new log, requires a correction note, preserves previous logs, and updates the latest occurrence summary.
- FR-16: The daily queue derives `OVERDUE` for unrecorded occurrences whose due datetime has passed without writing automatic missed rows.
- FR-17: Request details and Student Profile Health medication history expose request, review, occurrence, and administration log history.
- FR-18: Health Center exposes medication pending/due/overdue summary counts and navigation hints without merging full medication rows into existing health instruction/event arrays.
- FR-19: Medication V1 does not support attachments, exports, notifications, holiday/weekend exclusions, advanced recurrence, role-name-based nurse/teacher logic, or class-only teacher restrictions.
- FR-20: If an approved medication request creates a `StudentHealthInstruction` mirror, the mirror must be traceable to the Medication domain and must not become source of truth for administration state.

### Non-Functional Requirements

- NFR-1: Denied requests must not leak protected medication, health, guardian, or student data.
- NFR-2: Parent routes must resolve guardian identity server-side from the authenticated user and selected campus.
- NFR-3: Staff routes must use existing campus context, campus access, permissions guard, DTO validation, and standard response conventions.
- NFR-4: Medication review, occurrence creation, and administration record/correction writes must be transactional where multiple rows are changed.
- NFR-5: Mutating medication actions must write audit/timeline data sufficient to reconstruct who requested, reviewed, recorded, and corrected medication administration.
- NFR-6: List and daily queue results must be deterministic for identical filters and pagination inputs.
- NFR-7: Date-only and time-of-day fields must use documented backend normalization. V1 uses the backend/server timezone policy already used by health/absence flows unless implementation planning identifies an existing project timezone helper.
- NFR-8: Existing Student Health, Health Center, Guardian, and Absence Request behavior must remain backward compatible.

## Acceptance Criteria

- [ ] AC-1: An authenticated parent can create a medication request for an authorized child in the selected campus and receives a standard success response with status `SUBMITTED`.
- [ ] AC-2: A parent cannot create, list, or view medication requests for a student not linked to their current guardian profile.
- [ ] AC-3: Invalid request payloads, including missing item fields, invalid date range, empty `timesOfDay`, or invalid time format, return validation errors.
- [ ] AC-4: A parent can list and view their own medication request history in the selected campus.
- [ ] AC-5: A parent can cancel a `SUBMITTED` or `NEEDS_MORE_INFO` request and cannot cancel an approved, rejected, completed, expired, or already cancelled request.
- [ ] AC-6: A parent can respond to `NEEDS_MORE_INFO` and the response appears in staff request detail/history.
- [ ] AC-7: A permitted staff user can list campus medication requests with filters for status, student, class, and date range.
- [ ] AC-8: A staff user without medication read/list permission receives `403` and no medication values.
- [ ] AC-9: A permitted staff reviewer can approve, reject, or request more information for a submitted request.
- [ ] AC-10: Invalid or stale review transitions return a clear validation or conflict response and do not mutate request state.
- [ ] AC-11: Approving a request creates the expected number of administration occurrences for each medication item, each date in the inclusive range, and each scheduled time.
- [ ] AC-12: The daily administration queue returns due occurrence rows for selected campus/date and supports class/student/status filtering.
- [ ] AC-13: An unrecorded occurrence whose due datetime has passed is returned with derived `OVERDUE` status without an auto-created missed log.
- [ ] AC-14: A permitted staff user can record `GIVEN` with an optional note and the occurrence latest outcome updates.
- [ ] AC-15: A permitted staff user cannot record `SKIPPED`, `REFUSED`, or `ABSENT` without a note.
- [ ] AC-16: A permitted staff user can correct a recorded occurrence by appending a new log with a correction note; previous logs remain visible.
- [ ] AC-17: Concurrent duplicate or stale record/correction attempts produce a conflict response rather than silently overwriting latest state.
- [ ] AC-18: Staff request detail includes request fields, medication items, submitter/reviewer summaries, parent follow-up entries, occurrence summaries, administration logs, and timeline entries.
- [ ] AC-19: Student Profile Health medication history returns medication request and administration history for the selected student and campus.
- [ ] AC-20: Health Center medication summary returns pending, needs-more-info, due-today, and overdue counts plus navigation hints for users with appropriate medication read permissions.
- [ ] AC-21: Existing `/api/health-center/daily-items` instruction/event arrays remain backward compatible.
- [ ] AC-22: Medication V1 responses do not expose attachment upload/download fields as active functionality.
- [ ] AC-23: Focused backend tests cover parent authorization, staff permissions, validation, status transitions, occurrence generation, daily queue filters, overdue derivation, record/correction behavior, history responses, and Health Center summary counts.

## Scenarios

### Scenario 1: Parent Submits Request And Staff Approves

**Given** a parent is authenticated as a guardian in campus A and has a linked student in campus A  
**When** the parent submits a medication request with `startDate=2026-07-01`, `endDate=2026-07-03`, one medication item, and `timesOfDay=["12:30"]`  
**Then** the backend creates a `SUBMITTED` request scoped to campus A and the linked student.  
**And** a permitted staff reviewer can approve it.  
**And** approval creates three administration occurrences, one for each date at 12:30.

### Scenario 2: Parent Attempts Cross-Student Request

**Given** a parent is authenticated as a guardian in campus A  
**When** the parent submits a medication request for a student not linked to that guardian in campus A  
**Then** the backend rejects the request with `403` and creates no medication data.

### Scenario 3: Staff Requests More Information

**Given** a medication request is `SUBMITTED`  
**When** a permitted staff reviewer marks it `NEEDS_MORE_INFO` with a note  
**Then** the parent can see the request status and staff note.  
**And** the parent can respond with additional information.  
**And** the response appears in staff request detail/history.

### Scenario 4: Invalid Review Transition

**Given** a medication request is already `APPROVED`  
**When** staff attempts to reject it  
**Then** the backend rejects the transition and does not change occurrences or existing history.

### Scenario 5: Daily Administration Queue

**Given** an approved request has an occurrence due on `2026-07-01` at `12:30`  
**When** permitted staff calls the daily administration queue for `date=2026-07-01`  
**Then** the response includes the occurrence with student, class, medication, dosage, instructions, due date/time, and current status.

### Scenario 6: Non-Given Outcome Requires Note

**Given** a medication occurrence is due  
**When** permitted staff records outcome `REFUSED` without a note  
**Then** the backend rejects the request with a validation error.  
**When** staff records `REFUSED` with a note  
**Then** the backend appends an administration log and updates the occurrence latest outcome.

### Scenario 7: Correction Preserves History

**Given** a medication occurrence was recorded as `REFUSED`  
**When** permitted staff records a correction to `GIVEN` with a correction note  
**Then** the backend appends a new administration log, keeps the original `REFUSED` log, and returns latest outcome `GIVEN`.

### Scenario 8: Derived Overdue

**Given** an occurrence was due before the backend current time and has no administration log  
**When** permitted staff lists the daily queue  
**Then** the occurrence is returned as derived `OVERDUE`.  
**And** no automatic missed log row is created.

### Scenario 9: Student Profile Medication History

**Given** a student has approved medication requests and administration logs in campus A  
**When** permitted staff opens the Student Profile Health medication history endpoint for that student in campus A  
**Then** the backend returns request and administration history scoped to campus A only.

### Scenario 10: Health Center Summary

**Given** campus A has pending medication requests and overdue occurrences  
**When** a permitted staff user loads the Health Center medication summary  
**Then** the response includes pending, needs-more-info, due-today, and overdue counts plus navigation hints.  
**And** the existing Health Center daily-items instruction/event arrays are not changed to contain full medication occurrences.

## Technical Notes

- Implement this as a new backend vertical slice following current Clean Architecture conventions: domain entities, application ports/use cases, Prisma repositories/mappers, HTTP DTOs/controllers, and module wiring.
- Reuse the parent/guardian authorization pattern from Absence Request: `@RequireCampusAccess({ checkUserAccess: false })`, `HydrateCurrentUserGuard`, current guardian resolution, and `GuardianStudent` relationship checks.
- Reuse existing staff route conventions: `ClerkAuthGuard`, `RequireCampusAccess`, `PermissionsGuard`, `@Permissions`, DTO validation, and `StandardResponse`.
- Add medication permission catalog entries and update permission module validation as needed. Candidate permissions: `medication_request.list`, `medication_request.read`, `medication_request.review`, `medication_administration.read`, `medication_administration.record`, and `medication_administration.correct`. Final names may be adjusted during planning, but routes must not rely on generic `student_health.update` for administration recording.
- Add audit target types and recorder target-name resolution for medication request, occurrence, and administration log entities if medication writes use the existing audit event infrastructure.
- Keep request approval and occurrence materialization transactional. If any occurrence creation or optional Student Health instruction mirror creation fails, approval should roll back.
- Selected-date class filtering should reuse the current enrollment-on-date semantics used by Health Center and active class health instruction queries.
- Date-only and `HH:mm` validation should follow existing health/absence DTO/domain normalization style.
- Avoid advanced recurrence, holiday/weekend exclusion, notification delivery, exports, and attachments in V1.
- If the implementation chooses to create a `StudentHealthInstruction` mirror on approval, it should include medication title/instruction/dosage/date range/times and an internal reference strategy to trace back to the Medication domain.
- Add route metadata tests for guards/permissions, unit tests for domain/use-case status transitions, repository tests for occurrence generation/filtering where practical, and DTO serialization/validation tests for response shapes.

## Out Of Scope

- Medication attachment upload/download and prescription image policy.
- Notifications to parents/staff.
- Export/report generation.
- Advanced recurrence rules, selected weekdays, holiday calendars, or school-day calendars.
- Teacher class-only administration restrictions.
- Hardcoded nurse/admin role semantics.
- Editing approved medication details.
- Deleting medication requests, occurrences, or logs.
- Migrating old-system medication data.

## Task Links

- @task-7ya1j6 [medication-requests-and-administration-backend-01] Persistence, permissions, and parent request submission (todo)
- @task-57osdt [medication-requests-and-administration-backend-02] Parent medication request history and pre-review actions (todo)
- @task-0h2fmx [medication-requests-and-administration-backend-03] Staff medication request review and occurrence generation (todo)
- @task-g0lpbd [medication-requests-and-administration-backend-04] Daily administration queue and record/correction logs (todo)
- @task-78x304 [medication-requests-and-administration-backend-05] Medication request detail timeline and student history (todo)
- @task-fs2616 [medication-requests-and-administration-backend-06] Health Center medication summary integration (todo)
- @task-cadmbk [medication-requests-and-administration-backend-07] Integrated verification and regression hardening (todo)

## Open Questions

None for the current draft. Awaiting review/approval.
