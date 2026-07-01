---
title: Parent Request Center Medication Requests Frontend Handoff
description: Frontend handoff for building the parent-facing medication request screen and integrating with implemented backend APIs.
createdAt: '2026-07-01T16:42:18.347Z'
updatedAt: '2026-07-01T16:42:18.347Z'
tags:
  - frontend-handoff
  - parent-request-center
  - medication
  - medical-requests
  - api
  - auth
---

## Purpose

Backend-to-frontend handoff for building the Parent Request Center Medication Requests screen. This document summarizes the implemented parent-facing backend contract, auth model, UI states, validation constraints, and integration notes for a parent/guardian to submit and track medication requests.

Source refs:

- @doc/specs/2026-07-01/medication-requests-and-administration-backend
- @doc/specs/2026-06-28/parent-access-model-and-campus-discovery
- `src/infra/http/controllers/parent-medication-request.controller.ts`
- `src/infra/http/dtos/medication/*`

## 1. Feature Summary

Build a Parent Request Center screen for medication requests. A parent can:

- View their own medication requests for the selected campus.
- Filter by linked student, request status, and date range.
- Submit a new medication request for a student they are linked to.
- Open request detail and timeline.
- Cancel a request while it is still `SUBMITTED` or `NEEDS_MORE_INFO`.
- Respond with additional information when staff marks the request as `NEEDS_MORE_INFO`.

Parent medication request authorization is relationship-based. Parent routes do not use `medication_request.*` RBAC permissions. Staff and Super Admin routes use those permissions; parent routes use Clerk auth plus current guardian ownership checks.

## 2. Frontend Screen Scope

Suggested placement:

- Parent Request Center -> Medication Requests.
- Screen route can mirror the existing absence request center pattern, for example `/parent/request-center/medication-requests` or the current frontend route convention.

Primary screen regions:

- Header with selected campus context.
- Filter bar: student, status, from date, to date.
- Request list grouped or sorted by most recent update/creation.
- Empty state for no medication requests.
- Submit request action.
- Detail drawer/page showing request status, medication items, timeline, review note, cancellation reason, and available parent actions.

## 3. Auth And Access Model

Every parent endpoint requires:

- Clerk bearer token.
- `x-campus-id` header.
- Authenticated user must resolve to a guardian profile in the selected campus.
- For create/list filters/detail/actions, backend verifies the guardian is linked to the target student/request.

Important implementation note:

- Do not send `guardianId`, `requesterGuardianId`, or trusted `userId` from frontend. Backend derives them from the authenticated user.
- Parent routes intentionally use `@RequireCampusAccess({ checkUserAccess: false })`; campus role assignment is not required for parents. Guardian/student relationship is the authorization boundary.
- `medication_request.*` permissions are not required for parent routes.

## 4. API Contract

All routes below are under the backend global `/api` prefix if the frontend client is configured that way.

Standard response envelope:

```ts
type StandardResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
};
```

### List My Medication Requests

`GET /api/parent/medication-requests`

Headers:

```http
Authorization: Bearer <clerk-token>
x-campus-id: <campus-uuid>
```

Query params:

```ts
type ListMedicationRequestsQuery = {
  studentId?: string;
  status?: MedicationRequestStatus;
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
};
```

Response:

```ts
type Response = StandardResponse<MedicationRequest[]>;
```

Notes:

- `studentId` must be one of the current guardian's linked students in the selected campus.
- `fromDate` and `toDate` are date-only strings. Backend rejects invalid dates and `toDate < fromDate`.
- List response is currently an array, not paginated.

### Submit Medication Request

`POST /api/parent/medication-requests`

Payload:

```ts
type CreateMedicationRequestRequest = {
  studentId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string | null;
  parentNotes?: string | null;
  items: Array<{
    medicationName: string;
    dosage?: string | null;
    instructions: string;
    timesOfDay: string[]; // HH:mm, one or more, unique
    scheduleNotes?: string | null;
    notes?: string | null;
  }>;
};
```

Example:

```json
{
  "studentId": "44444444-4444-4444-8444-444444444445",
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

Response:

```ts
type Response = StandardResponse<MedicationRequest>;
```

Validation rules frontend should mirror:

- `studentId` is required and must be a UUID.
- `startDate` and `endDate` must be strict `YYYY-MM-DD` strings.
- `endDate` must be on or after `startDate`.
- `items` must contain at least one item.
- `medicationName` is required, max 200 chars.
- `dosage` optional, max 200 chars.
- `instructions` required, max 4000 chars.
- `timesOfDay` must contain one or more unique `HH:mm` values from `00:00` to `23:59`.
- `scheduleNotes`, item `notes`, `reason`, and `parentNotes` are optional, max 4000 chars.
- Attachments/prescription image upload is not supported in V1. Do not build active upload UI for this flow yet.

### Get My Medication Request Detail

`GET /api/parent/medication-requests/:requestId`

Response:

```ts
type Response = StandardResponse<MedicationRequest>;
```

Backend returns the request only if it belongs to the authenticated guardian in the selected campus.

### Cancel My Medication Request

`POST /api/parent/medication-requests/:requestId/cancel`

Payload:

```ts
type CancelMedicationRequestRequest = {
  reason?: string | null; // max 4000
};
```

Allowed statuses:

- `SUBMITTED`
- `NEEDS_MORE_INFO`

Response:

```ts
type Response = StandardResponse<MedicationRequest>;
```

Frontend behavior:

- Show cancel action only for `SUBMITTED` or `NEEDS_MORE_INFO`.
- Hide/disable cancel for `APPROVED`, `REJECTED`, `CANCELLED`, `COMPLETED`, `EXPIRED`.
- After successful cancel, refresh list/detail or patch local status to `CANCELLED`.

### Respond To Staff Info Request

`POST /api/parent/medication-requests/:requestId/respond`

Payload:

```ts
type RespondMedicationRequestRequest = {
  message: string; // required, max 4000
};
```

Allowed status:

- `NEEDS_MORE_INFO`

Response:

```ts
type Response = StandardResponse<MedicationRequest>;
```

Frontend behavior:

- Show respond action only when `status === "NEEDS_MORE_INFO"`.
- Display `reviewNote` prominently as staff's question/context.
- After successful response, backend transitions the request back to `SUBMITTED` and adds a `PARENT_RESPONDED` timeline entry.

## 5. Response Shape

```ts
type MedicationRequestStatus =
  | "SUBMITTED"
  | "NEEDS_MORE_INFO"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "EXPIRED";

type MedicationRequestTimelineAction =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_MORE_INFO"
  | "CANCELLED"
  | "PARENT_RESPONDED";

type MedicationRequestTimelineActorType = "GUARDIAN" | "STAFF" | "SYSTEM";

type MedicationRequest = {
  id: string;
  campusId: string;
  studentId: string;
  student: {
    id: string;
    fullName: string;
    studentCode: string | null;
  } | null;
  requesterGuardianId: string;
  requesterGuardian: {
    id: string;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
  } | null;
  status: MedicationRequestStatus;
  startDate: string; // serialized Date, usually ISO string
  endDate: string;   // serialized Date, usually ISO string
  reason: string | null;
  parentNotes: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: MedicationRequestItem[];
  timelineEntries: MedicationRequestTimelineEntry[];
  createdAt: string;
  updatedAt: string;
};

type MedicationRequestItem = {
  id: string;
  medicationName: string;
  dosage: string | null;
  instructions: string;
  timesOfDay: string[];
  scheduleNotes: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type MedicationRequestTimelineEntry = {
  id: string;
  requestId: string;
  campusId: string;
  actorType: MedicationRequestTimelineActorType;
  actorUserId: string | null;
  actorGuardianId: string | null;
  action: MedicationRequestTimelineAction;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Date note:

- Create/list query dates are strict date-only `YYYY-MM-DD`.
- Response `startDate`/`endDate` are exposed as serialized `Date` values, so frontend should tolerate ISO datetime strings and render only the date portion for date-range UI.

## 6. Suggested UI State Model

List item display:

- Student name and student code.
- Status badge.
- Date range.
- Medication item summary: first medication name plus count when multiple items exist.
- Last updated time.
- Staff review note indicator when `NEEDS_MORE_INFO`.

Detail display:

- Status and timeline.
- Student summary.
- Date range.
- Reason and parent notes.
- Medication items with dosage, instructions, times of day, schedule notes, item notes.
- Staff review note and reviewed timestamp when available.
- Cancel reason/cancelled timestamp when cancelled.

Primary actions by status:

| Status | Parent action |
| --- | --- |
| `SUBMITTED` | View, cancel |
| `NEEDS_MORE_INFO` | View, respond, cancel |
| `APPROVED` | View only |
| `REJECTED` | View only |
| `CANCELLED` | View only |
| `COMPLETED` | View only |
| `EXPIRED` | View only |

Recommended empty states:

- No requests: "No medication requests yet" with submit CTA.
- No filtered results: "No requests match these filters" with clear filters action.
- Guardian has no linked students in campus: block submit and point user to contact school/admin.

## 7. Error States To Handle

Expected HTTP statuses:

- `400`: invalid payload, invalid date, date range issue, invalid status.
- `401`: missing/expired Clerk session.
- `403`: current guardian is not linked to the selected student/request, or user cannot resolve as guardian for campus.
- `404`: request/student not found in current guardian/campus scope.
- `409`: state transition conflict, for example cancelling after staff already approved/rejected.
- `500`: unexpected server error.

Frontend should treat `403` and `404` similarly from a privacy perspective: do not reveal whether another guardian's request exists.

## 8. Integration Notes

- Use the same API client/auth header conventions as the existing parent request center absence flow.
- Always pass the currently selected campus via `x-campus-id`.
- Do not build pagination controls for parent list unless backend later changes this endpoint; current parent list returns an array.
- Do not build active attachments/upload controls for V1.
- The staff/Super Admin Medication Request Center uses `/api/medication-requests` and `medication_request.*` permissions. Do not call those endpoints from the parent screen.
- The Health Center administration queue is separate from parent submission and is not needed for the parent request screen.

## 9. Frontend Acceptance Criteria

- Parent can open Medication Requests from Parent Request Center.
- Parent can list their own requests for selected campus.
- Parent can filter by linked student, status, and date range.
- Parent can submit a request with one or more medication items and one or more times per day.
- Frontend validates required fields, strict date-only values, date range order, max lengths, and `HH:mm` times before submit.
- Parent can open request detail and see status, items, timeline, review note, cancellation reason, and timestamps.
- Parent can cancel only `SUBMITTED` or `NEEDS_MORE_INFO` requests.
- Parent can respond only to `NEEDS_MORE_INFO` requests.
- Parent UI does not require or check `medication_request.*` permissions.
- Parent UI does not expose attachment upload/download controls for V1.
