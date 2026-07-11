---
title: Health Center Backend Aggregate API
description: Specification for a read-only Health Center daily aggregate backend API.
createdAt: '2026-07-01T04:34:48.608Z'
updatedAt: '2026-07-10T22:04:58.959Z'
tags:
  - spec
  - approved
  - health-center
  - student-health
  - backend
  - api
---

# Health Center Backend Aggregate API

## Overview

Build a read-only, campus-scoped Health Center aggregate API for the Health Center daily operations page. The endpoint returns active health instructions and current-open health events for a selected date, optionally narrowed to one class, using the existing Student Health V1 data model and permission model.

Supporting context:

- @doc/archive/research/health-center-backend-research
- @doc/specs/2026-07-01/student-profile-health-tab-backend

## Locked Decisions

- D1: Expose the aggregate as `GET /api/health-center/daily-items`.
- D2: Return a grouped response with top-level `instructions`, `events`, and `counts` sections.
- D3: Open event V1 semantics are current `status = OPEN` and `occurredAt <= selected day end`; do not add status-history reconstruction.
- D4: `classId` filtering uses selected-date enrollment semantics, matching the existing class active-instructions behavior.
- D5: The aggregate response includes enough fields for the Health Center detail modal; the frontend must not need a follow-up detail fetch just to open the modal.
- D6: The endpoint supports pagination for the Health Center result groups.
- D7: V1 Health Center reads require authorization/RBAC only; do not audit aggregate reads. Audit remains for future mutation/edit workflows.

## API Contract

### GET `/api/health-center/daily-items`

Returns active health instructions and current-open health events for the active campus.

Required access:

- Authenticated Clerk session.
- Active campus context using the existing backend campus convention, including `X-Campus-Id` when required by the API client.
- Campus access enforced through the existing campus guard pattern.
- Required permission: `student_health.read`.

Query params:

- `date`: optional `YYYY-MM-DD`. If omitted, backend uses the server current date, matching existing Student Health active-instruction behavior.
- `classId`: optional class UUID. When present, results are limited to students enrolled in that class on the selected date.
- `instructionsOffset`: optional integer, default `0`.
- `instructionsLimit`: optional integer, default `50`, maximum `100`.
- `eventsOffset`: optional integer, default `0`.
- `eventsLimit`: optional integer, default `50`, maximum `100`.

Response data shape:

```json
{
  "campusId": "campus_uuid",
  "date": "2026-07-01",
  "classId": "class_uuid_or_null",
  "counts": {
    "instructions": 12,
    "events": 3,
    "total": 15
  },
  "pagination": {
    "instructions": {
      "offset": 0,
      "limit": 50,
      "total": 12,
      "hasMore": false
    },
    "events": {
      "offset": 0,
      "limit": 50,
      "total": 3,
      "hasMore": false
    }
  },
  "instructions": [
    {
      "id": "instruction_uuid",
      "studentId": "student_uuid",
      "campusId": "campus_uuid",
      "student": {
        "id": "student_uuid",
        "fullName": "Student Name",
        "avatarUrl": null
      },
      "class": {
        "id": "class_uuid",
        "name": "Lop La 1"
      },
      "instructionType": "MEDICATION",
      "title": "Antibiotic after lunch",
      "instruction": "Give the medication after lunch with water.",
      "dosage": "5 ml",
      "startDate": "2026-07-01",
      "endDate": "2026-07-05",
      "timesOfDay": ["12:30"],
      "scheduleNotes": "After lunch only.",
      "notes": "Call guardian if vomiting occurs.",
      "isActive": true,
      "status": "ACTIVE",
      "createdBy": {
        "id": "user_uuid",
        "fullName": "School Nurse"
      },
      "lastUpdatedBy": null,
      "createdAt": "2026-07-01T08:30:00.000Z",
      "updatedAt": "2026-07-01T08:30:00.000Z"
    }
  ],
  "events": [
    {
      "id": "event_uuid",
      "studentId": "student_uuid",
      "campusId": "campus_uuid",
      "student": {
        "id": "student_uuid",
        "fullName": "Student Name",
        "avatarUrl": null
      },
      "class": {
        "id": "class_uuid",
        "name": "Lop La 1"
      },
      "eventType": "ILLNESS",
      "category": "EYE",
      "title": "Eye redness observed",
      "description": "Teacher noticed redness in the left eye after nap time.",
      "occurredAt": "2026-07-01T14:00:00.000Z",
      "status": "OPEN",
      "resolutionNotes": null,
      "recordedBy": {
        "id": "user_uuid",
        "fullName": "Class Teacher"
      },
      "lastUpdatedBy": null,
      "createdAt": "2026-07-01T14:10:00.000Z",
      "updatedAt": "2026-07-01T14:10:00.000Z"
    }
  ]
}
```

Ordering:

- Instructions must use a deterministic order suitable for daily operations. Default: earliest actionable schedule first, then student display name, then creation time.
- Events must default to most recent `occurredAt` first.

## Requirements

### Functional Requirements

- FR-1: Provide `GET /api/health-center/daily-items` as a read-only aggregate endpoint for the active campus.
- FR-2: Require existing auth, active campus access, and `student_health.read` before returning any health values.
- FR-3: Accept optional `date` in `YYYY-MM-DD`; reject invalid dates with the existing validation error format.
- FR-4: Default `date` to the server current date when omitted.
- FR-5: Accept optional `classId`; when supplied, verify the class belongs to the active campus and filter by students enrolled in that class on the selected date.
- FR-6: Return only active health instructions for the selected date using existing Student Health active-status semantics.
- FR-7: Return only health events whose current status is `OPEN` and whose `occurredAt` is on or before the selected day end.
- FR-8: Exclude resolved or archived events from the aggregate.
- FR-9: Return grouped `instructions`, `events`, `counts`, and pagination metadata in a stable success shape, including empty arrays when no items match.
- FR-10: Include student summary and selected-date class summary on each instruction and event item when available.
- FR-11: Include enough instruction/event detail fields for the Health Center detail modal without requiring an immediate follow-up detail API call.
- FR-12: Include record IDs and `studentId` so the frontend can navigate to the Student Profile Health tab when needed.
- FR-13: Support independent `offset`/`limit` pagination for instruction and event groups using the query params defined in the API contract.
- FR-14: Preserve existing Student Profile Health endpoints and behavior unchanged.
- FR-15: Do not introduce write actions, event resolution, medication administration logging, checkup lists, parent request handling, document attachments, or status-history reconstruction in this feature.

### Non-Functional Requirements

- NFR-1: Denied requests must not leak health payload values.
- NFR-2: The endpoint must use the existing backend response envelope and error conventions.
- NFR-3: The endpoint must be deterministic for the same campus, date, filters, and pagination inputs.
- NFR-4: V1 aggregate reads must not write audit records.
- NFR-5: Implementation must avoid changing existing Student Health permissions; use `student_health.read` rather than adding `health_center.read`.

## Acceptance Criteria

- [x] AC-1: A permitted staff user with an active campus can call `GET /api/health-center/daily-items` and receive a success response with `instructions`, `events`, `counts`, and `pagination` fields.
- [x] AC-2: A user without `student_health.read` receives `403` and no health values.
- [x] AC-3: Missing or invalid campus context follows existing campus error behavior and returns no health values.
- [x] AC-4: Invalid `date` returns a validation error using the existing backend error format.
- [x] AC-5: Unknown or cross-campus `classId` is rejected consistently with existing class/campus access behavior.
- [x] AC-6: Without `classId`, the endpoint returns active instructions across the active campus for the selected date.
- [x] AC-7: With `classId`, instructions are limited to students enrolled in that class on the selected date.
- [x] AC-8: With `classId`, events are limited to students enrolled in that class on the selected date.
- [x] AC-9: Current-open events from earlier dates remain visible when `occurredAt` is on or before the selected day end.
- [x] AC-10: Resolved or archived events are excluded even if they occurred on or before the selected day.
- [x] AC-11: Empty result sets return success with empty arrays, zero counts, and pagination totals of zero.
- [x] AC-12: Pagination params limit each group independently and expose total counts plus `hasMore` values.
- [x] AC-13: Instruction items include IDs, student summary, class summary when available, type/status labels, schedule fields, note fields, author metadata, and timestamps needed by the detail modal.
- [x] AC-14: Event items include IDs, student summary, class summary when available, type/status labels, description, occurrence time, resolution fields, author metadata, and timestamps needed by the detail modal.
- [x] AC-15: Existing Student Profile Health endpoints continue to pass their current tests unchanged.

## Scenarios

### Scenario 1: Staff Opens Health Center For Today

**Given** a staff user has active campus access and `student_health.read`  
**When** the user calls `GET /api/health-center/daily-items` without query params  
**Then** the backend returns today's active campus instructions and current-open events in the grouped aggregate shape.

### Scenario 2: Staff Filters Health Center By Class And Date

**Given** a staff user has active campus access and `student_health.read`  
**And** students were enrolled in class A on `2026-07-01`  
**When** the user calls `GET /api/health-center/daily-items?date=2026-07-01&classId=class_A`  
**Then** the backend returns only matching instructions and open events for students enrolled in class A on that selected date.

### Scenario 3: Older Open Event Still Needs Attention

**Given** a student has an event with `status = OPEN` and `occurredAt = 2026-06-30T15:00:00.000Z`  
**When** a permitted user calls the endpoint for `date=2026-07-01`  
**Then** the event is included because it is still currently open and occurred before the selected day end.

### Scenario 4: Resolved Event Is Not Shown

**Given** a student has an event that occurred before the selected day end  
**And** the event current status is `RESOLVED`  
**When** a permitted user calls the endpoint  
**Then** the event is not included in the Health Center aggregate.

### Scenario 5: No Matching Health Items

**Given** the active campus has no active instructions and no current-open events for the selected filters  
**When** a permitted user calls the endpoint  
**Then** the backend returns success with `instructions: []`, `events: []`, zero counts, and pagination totals of zero.

### Scenario 6: User Lacks Health Read Permission

**Given** a user has campus access but lacks `student_health.read`  
**When** the user calls `GET /api/health-center/daily-items`  
**Then** the backend rejects the request with `403` and does not return health values.

### Scenario 7: Invalid Date

**Given** a permitted staff user has active campus access  
**When** the user calls `GET /api/health-center/daily-items?date=07-01-2026`  
**Then** the backend returns a validation error because the date is not `YYYY-MM-DD`.

## Technical Notes

- The route may be implemented with a Health Center controller/module, but it should reuse the existing Student Health application/repository patterns where practical.
- Reuse existing date normalization helpers and active-instruction semantics from Student Health V1.
- Reuse selected-date enrollment lookup behavior from the existing class active-instructions endpoint.
- Add campus-wide repository/application queries for active instructions and open events rather than querying every student one by one.
- Keep `student_health.read` as the permission; do not seed or require a new Health Center permission in V1.
- Use the current response envelope, DTO validation, guards, and permissions guard conventions.
- Add focused backend tests around campus access, RBAC, date validation, class filtering, selected-date enrollment, pagination, empty states, open-event semantics, and regression coverage for existing Student Health endpoints.

## Out Of Scope

- New `health_center.read` permission.
- Health Center write actions.
- Event resolution from the Health Center page.
- Medication administration or mark-done logging.
- Latest checkup summaries in the Health Center aggregate.
- Parent requests, documents, attachments, intake links, or guardian-facing workflows.
- Historical event status reconstruction after resolution.
- Read audit logging for the aggregate endpoint.
- Teacher class-only visibility changes beyond existing `student_health.read` semantics.

## Task Links

- @task-it3lyg [health-center-backend-aggregate-api-01] Implement Health Center daily aggregate API (done)

## Open Questions

None for the current draft. Awaiting review/approval.
