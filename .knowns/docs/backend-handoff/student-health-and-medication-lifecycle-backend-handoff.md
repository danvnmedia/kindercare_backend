---
title: 'Frontend Handoff: Student Health and Medication Lifecycle Backend'
description: Practical frontend integration contract for campus timezone, health archives, medication terminal lifecycle, Health Center behavior, RBAC, rollout, and known limitations.
createdAt: '2026-07-14T17:46:32.182Z'
updatedAt: '2026-07-14T18:23:44.575Z'
tags:
  - backend-handoff
  - frontend
  - api
  - student-health
  - medication
  - rbac
---

# Frontend Handoff: Student Health and Medication Lifecycle Backend

Status: backend implementation complete and locally verified on 2026-07-14. Database migrations and the permission seed have not been applied to a deployed environment by this implementation work.

This document is the practical frontend contract for the student-health archive, campus-timezone, medication-lifecycle, and permission changes. API paths below include the global `/api` prefix.

## 1. Backend summary

### What was completed

The backend now provides:

- a required IANA timezone on every campus;
- campus-local date, medication due-time, expiration, completion, overdue, and Health Center calculations, including deterministic daylight-saving behavior;
- recoverable archival for student health checkups, instructions, and events;
- active-only health lists by default, with explicit archived-history browsing;
- `COMPLETED` and `EXPIRED` medication-request lifecycle states and nullable terminal timestamps;
- a five-minute, bounded, concurrency-safe medication lifecycle reconciler;
- command-time expiration guards for staff review, parent response, and parent cancellation;
- continued recording and correction of medication administrations after a request completes;
- a cleaned medication permission catalog and an archive-specific `student_health.delete` permission;
- all-permissions enforcement for the combined Health Center medication summary.

The implementation extended the existing Clean Architecture modules rather than creating a parallel API. The affected systems are Campus, Student Health, Medication Requests, Medication Administration, Health Center, campus-scoped RBAC, Audit, Prisma persistence/migrations, seed data, and the cron module.

### Important final decisions and changes from the original direction

- No dedicated latest-checkup endpoint was added. Health Snapshot continues to use the ordinary checkup list with `limit=1`, `offset=0`, `sort=-checkedAt`, and no `includeArchived` parameter.
- Health `DELETE` means archive, not physical deletion. It returns the archived resource and is idempotent. Restore is not included.
- `isArchived` is derived from `archivedAt`; it is not an independently writable field.
- `ARCHIVED` is no longer a health-event clinical status. Event status is only `OPEN` or `RESOLVED`; archival is represented separately by archive metadata.
- Ordinary health-history lists may accept `includeArchived=true`; dedicated operational queries do not expose an archive override.
- `student_health.delete` is created by the canonical permission seed, not inserted by a migration.
- Medication terminal timestamps are effective business boundaries, not the time the five-minute cron happened to run.
- Completion is based on the final scheduled occurrence, not on all doses having outcomes.
- Medication lifecycle changes never create, edit, or archive Student Health instructions/events. Student medication history remains the read-only integration between the two domains.
- The Health Center medication summary requires both medication read permissions. Existing multi-permission routes continue to use their existing OR semantics unless explicitly documented otherwise.

### Verification completed

- Prisma schema validation and client generation passed.
- TypeScript type checking, production build, lint, and diff checks passed.
- Full Jest result: 308 suites, 2,395 tests passed, and 1 intentional skip.
- Strict specification validation passed.

## 2. Shared HTTP contract

### Base URL, authentication, and campus context

All endpoints in this handoff use:

```http
Authorization: Bearer <Clerk JWT>
```

All student-health, medication, administration, and Health Center endpoints also require:

```http
x-campus-id: <campus UUID>
```

The backend uses the selected campus as an enforced data boundary. A resource from another campus, or one attached to a different student/guardian, is normally reported as `404` so its existence is not disclosed.

Campus management endpoints are authenticated but do not use `x-campus-id`; their existing access model was not changed by this work.

### Success envelope

Non-paginated responses use:

```json
{
  "success": true,
  "message": "Operation-specific message",
  "data": {},
  "timestamp": "2026-07-14T16:30:00.000Z"
}
```

Paginated responses add:

```json
{
  "pagination": {
    "count": 1,
    "limit": 10,
    "offset": 0,
    "totalPages": 1,
    "currentPage": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

Standard list defaults are `limit=10`, `offset=0`, with a maximum `limit=50`, unless an endpoint documents different pagination. Sort values are comma-separated; prefix a field with `-` for descending order, for example `sort=-checkedAt`.

### Date and time formats

- Date-only values are `YYYY-MM-DD` and represent campus calendar dates. Do not convert them to UTC dates in the client.
- Time-only values are 24-hour `HH:mm` and represent campus wall-clock time.
- Timestamps are ISO-8601 instants, normally serialized with `Z`.
- `Campus.timeZone` is an IANA identifier such as `Asia/Ho_Chi_Minh` or `America/Toronto`.

### Error envelope and meanings

The API uses standard NestJS error responses:

```json
{
  "statusCode": 409,
  "message": "Medication request is no longer actionable",
  "error": "Conflict"
}
```

Validation failures may return `message` as an array:

```json
{
  "statusCode": 400,
  "message": [
    "timeZone must be a valid IANA timezone"
  ],
  "error": "Bad Request"
}
```

| Status | Frontend meaning |
| --- | --- |
| `400` | Payload/query validation failed, an empty patch was sent, a date/state transition is invalid, or an active health record belongs to an archived student. Show the returned message near the form/action. |
| `401` | Missing or invalid Clerk JWT. Reauthenticate. |
| `403` | Missing campus access, required staff permission, or guardian ownership. Do not infer access from hidden UI alone. |
| `404` | Resource is absent or outside the selected campus/student/guardian scope. |
| `409` | Resource changed concurrently, an archived health record cannot be updated, a medication request is no longer actionable, or an administration correction is stale. Refetch before presenting further actions. |

Unknown request fields are rejected because global validation is whitelist-based with non-whitelisted fields forbidden.

## 3. Final API contract

### 3.1 Campus timezone

| Method and path | Requirement | Request/query | Response |
| --- | --- | --- | --- |
| `POST /api/campuses` | Clerk auth; existing campus-management access model | Campus create payload below | Campus |
| `GET /api/campuses` | Clerk auth | Standard pagination/filtering | Paginated Campus[]; each campus includes `timeZone` |
| `GET /api/campuses/:id` | Clerk auth | None | Campus |
| `PATCH /api/campuses/:id` | Clerk auth; existing campus-management access model | Partial campus payload | Updated Campus |

Create payload:

```ts
type CreateCampusRequest = {
  name: string;                 // required, 1..200 chars
  timeZone: string;             // required, valid IANA identifier
  address?: string;             // optional, max 500
  phoneNumber?: string;         // optional, E.164 such as +14165550100
  isArchived?: boolean;         // optional, default false
};
```

Update accepts the same fields as optional. `address` and `phoneNumber` can be cleared with `null`; `timeZone`, when present, must remain a valid IANA identifier.

Campus response:

```ts
type Campus = {
  id: string;
  name: string;
  address: string | null;
  phoneNumber: string | null;
  timeZone: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};
```

Example:

```http
POST /api/campuses
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Toronto Campus",
  "timeZone": "America/Toronto",
  "phoneNumber": "+14165550100"
}
```

```json
{
  "success": true,
  "message": "Campus created successfully",
  "data": {
    "id": "11111111-1111-4111-a111-111111111111",
    "name": "Toronto Campus",
    "address": null,
    "phoneNumber": "+14165550100",
    "timeZone": "America/Toronto",
    "isArchived": false,
    "createdAt": "2026-07-14T16:30:00.000Z",
    "updatedAt": "2026-07-14T16:30:00.000Z"
  },
  "timestamp": "2026-07-14T16:30:00.100Z"
}
```

Duplicate campus names return `409`; missing/invalid timezone or invalid phone format returns `400`.

### 3.2 Student health endpoint matrix

All routes below require Clerk auth and `x-campus-id`.

| Method and path | Required permission | Contract |
| --- | --- | --- |
| `GET /api/students/:studentId/health-profile` | `student_health.read` | Existing profile contract; unchanged by archive work. |
| `PATCH /api/students/:studentId/health-profile` | `student_health.update` | Existing full-list replacement profile patch; unchanged. |
| `GET /api/students/:studentId/health-checkups` | `student_health.read` | Paginated active records by default; supports `includeArchived`. |
| `POST /api/students/:studentId/health-checkups` | `student_health.create` | Create checkup. |
| `GET /api/students/:studentId/health-checkups/:checkupId` | `student_health.read` | Returns active or archived detail. |
| `PATCH /api/students/:studentId/health-checkups/:checkupId` | `student_health.update` | Updates an active checkup; archived returns `409`. |
| `DELETE /api/students/:studentId/health-checkups/:checkupId` | `student_health.delete` only | Archives and returns the retained checkup. |
| `GET /api/students/:studentId/health-instructions` | `student_health.read` | Paginated active records by default; supports `includeArchived`. |
| `POST /api/students/:studentId/health-instructions` | `student_health.create` | Create instruction. |
| `GET /api/students/:studentId/health-instructions/active` | `student_health.read` | Operational active-only query; no archive override. |
| `GET /api/students/:studentId/health-instructions/:instructionId` | `student_health.read` | Returns active or archived detail. |
| `PATCH /api/students/:studentId/health-instructions/:instructionId` | `student_health.update` | Updates active instruction; archived returns `409`. |
| `DELETE /api/students/:studentId/health-instructions/:instructionId` | `student_health.delete` only | Archives and returns retained instruction. |
| `GET /api/classes/:classId/health-instructions/active` | `student_health.read` | Active-only instructions grouped by active class students; no archive override. |
| `GET /api/students/:studentId/health-events` | `student_health.read` | Paginated active records by default; supports `includeArchived`. |
| `POST /api/students/:studentId/health-events` | `student_health.create` | Create event. |
| `GET /api/students/:studentId/health-events/:eventId` | `student_health.read` | Returns active or archived detail. |
| `PATCH /api/students/:studentId/health-events/:eventId` | `student_health.update` | Updates active event; archived returns `409`. |
| `DELETE /api/students/:studentId/health-events/:eventId` | `student_health.delete` only | Archives and returns retained event. |

`student_health.update` is not an alternative to `student_health.delete`.

#### Health list queries

All three ordinary lists support standard `limit`, `offset`, `sort`, and JSON-string `filter` parameters. They additionally accept:

```ts
type HealthHistoryQuery = {
  includeArchived?: "true" | "false"; // default false; literal values only
};

type InstructionListQuery = HealthHistoryQuery & {
  status?: "UPCOMING" | "ACTIVE" | "EXPIRED" | "INACTIVE";
  date?: string; // YYYY-MM-DD reference date for derived status
};

type EventListQuery = HealthHistoryQuery & {
  status?: "OPEN" | "RESOLVED";
  eventType?: "ILLNESS" | "INJURY" | "SYMPTOM" | "OBSERVATION" | "OTHER";
};
```

Malformed values such as `includeArchived=1`, `yes`, or an empty string return `400`.

Allowed sort fields:

- Checkups: `checkupType`, `checkedAt`, `heightCm`, `weightKg`, `createdAt`, `updatedAt`.
- Instructions: `instructionType`, `title`, `startDate`, `endDate`, `isActive`, `createdAt`, `updatedAt`.
- Events: `eventType`, `category`, `title`, `occurredAt`, `status`, `createdAt`, `updatedAt`.

#### Health Snapshot latest checkup

Use exactly the existing list contract:

```http
GET /api/students/:studentId/health-checkups?limit=1&offset=0&sort=-checkedAt
```

Do not send `includeArchived`. Read `response.data[0]`; it is the newest active checkup or `undefined` when none exists. There is no `/latest` endpoint.

Example response:

```json
{
  "success": true,
  "message": "Student health checkups retrieved successfully",
  "data": [
    {
      "id": "33333333-3333-4333-a333-333333333333",
      "studentId": "22222222-2222-4222-a222-222222222222",
      "campusId": "11111111-1111-4111-a111-111111111111",
      "checkupType": "GROWTH",
      "checkedAt": "2026-07-14T13:00:00.000Z",
      "heightCm": 108.5,
      "weightKg": 18.6,
      "notes": null,
      "recordedBy": { "id": "44444444-4444-4444-a444-444444444444", "fullName": "Avery Nurse" },
      "lastUpdatedBy": null,
      "archivedAt": null,
      "archivedByUserId": null,
      "isArchived": false,
      "createdAt": "2026-07-14T13:05:00.000Z",
      "updatedAt": "2026-07-14T13:05:00.000Z"
    }
  ],
  "pagination": {
    "count": 1,
    "limit": 1,
    "offset": 0,
    "totalPages": 1,
    "currentPage": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "timestamp": "2026-07-14T16:30:00.000Z"
}
```

#### Archive example

```http
DELETE /api/students/22222222-2222-4222-a222-222222222222/health-checkups/33333333-3333-4333-a333-333333333333
Authorization: Bearer <token>
x-campus-id: 11111111-1111-4111-a111-111111111111
```

The response is `200`, not `204`, and contains the same resource with:

```json
{
  "success": true,
  "message": "Student health checkup archived successfully",
  "data": {
    "id": "33333333-3333-4333-a333-333333333333",
    "archivedAt": "2026-07-14T16:31:00.000Z",
    "archivedByUserId": "44444444-4444-4444-a444-444444444444",
    "isArchived": true
  },
  "timestamp": "2026-07-14T16:31:00.100Z"
}
```

The real payload includes all normal resource fields; only archive-relevant fields are shortened above. Repeating the request returns the original archive metadata and does not create another audit entry.

### 3.3 Health Center operational endpoints

| Method and path | Requirement | Query | Response |
| --- | --- | --- | --- |
| `GET /api/health-center/daily-items` | Campus access + `student_health.read` | `date?`, `classId?`, independent instruction/event pagination | Daily instructions and open events |
| `GET /api/health-center/medication-summary` | Campus access + both `medication_request.read` and `medication_administration.read`, or global Super Admin | `date?` | Medication counts and UI link hints |

Daily-items query:

```ts
type HealthCenterDailyItemsQuery = {
  date?: string;                // YYYY-MM-DD; omitted = campus-local today
  classId?: string;             // UUID
  instructionsOffset?: number;  // default 0
  instructionsLimit?: number;   // default 50, max 100
  eventsOffset?: number;        // default 0
  eventsLimit?: number;         // default 50, max 100
};
```

Daily-items response data:

```ts
type HealthCenterDailyItems = {
  campusId: string;
  date: string;
  classId: string | null;
  counts: { instructions: number; events: number; total: number };
  pagination: {
    instructions: { offset: number; limit: number; total: number; hasMore: boolean };
    events: { offset: number; limit: number; total: number; hasMore: boolean };
  };
  instructions: HealthCenterInstructionItem[];
  events: HealthCenterEventItem[];
};
```

Instruction/event items contain the health fields described below plus `student: { id, fullName, avatarUrl }` and nullable `class: { id, name }`. Archive metadata is intentionally not exposed here because archived records are always excluded. Events are restricted to active `OPEN` events; instructions are restricted to active instructions for the reference date.

Medication-summary response example:

```json
{
  "success": true,
  "message": "Health Center medication summary retrieved successfully",
  "data": {
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
  },
  "timestamp": "2026-07-14T16:30:00.000Z"
}
```

The two `links` values are frontend navigation hints. They are not backend API endpoint paths.

### 3.4 Medication request endpoints

All routes require Clerk auth and `x-campus-id`.

#### Guardian routes

These do not use staff permission IDs. The backend resolves the authenticated user to a guardian and enforces guardian/student/campus ownership.

| Method and path | Request/query | Response |
| --- | --- | --- |
| `GET /api/parent/medication-requests` | `studentId?`, `status?`, `fromDate?`, `toDate?` | `MedicationRequest[]` without pagination |
| `POST /api/parent/medication-requests` | Create payload below | MedicationRequest |
| `GET /api/parent/medication-requests/:requestId` | None | Parent medication detail including occurrences/logs |
| `POST /api/parent/medication-requests/:requestId/cancel` | `{ reason?: string | null }` | Updated MedicationRequest |
| `POST /api/parent/medication-requests/:requestId/respond` | `{ message: string }` | Updated MedicationRequest |

Create payload:

```ts
type CreateMedicationRequest = {
  studentId: string;       // required UUID; must be an active owned student in campus
  startDate: string;       // required YYYY-MM-DD
  endDate: string;         // required YYYY-MM-DD; must be >= startDate
  reason?: string | null;  // max 4000
  parentNotes?: string | null; // max 4000
  items: Array<{
    medicationName: string;     // required, non-empty, max 200
    dosage?: string | null;     // max 200
    instructions: string;       // required, non-empty, max 4000
    timesOfDay: string[];        // required, non-empty, unique HH:mm values
    scheduleNotes?: string | null; // max 4000
    notes?: string | null;      // max 4000
  }>;
};
```

Example:

```http
POST /api/parent/medication-requests
Authorization: Bearer <token>
x-campus-id: 11111111-1111-4111-a111-111111111111
Content-Type: application/json

{
  "studentId": "22222222-2222-4222-a222-222222222222",
  "startDate": "2026-07-15",
  "endDate": "2026-07-17",
  "reason": "Short antibiotic course",
  "parentNotes": "Call if vomiting occurs.",
  "items": [
    {
      "medicationName": "Antibiotic syrup",
      "dosage": "5 ml",
      "instructions": "Give after lunch with water.",
      "timesOfDay": ["12:30"]
    }
  ]
}
```

#### Staff routes

| Method and path | Required permission | Request/query | Response |
| --- | --- | --- | --- |
| `GET /api/medication-requests` | `medication_request.list` | Standard pagination plus `status?`, `studentId?`, `classId?`, `fromDate?`, `toDate?`, `search?` | Paginated MedicationRequest[] |
| `GET /api/medication-requests/:requestId` | `medication_request.read` | None | Staff detail with reviewer and occurrences/logs |
| `POST /api/medication-requests/:requestId/review` | `medication_request.update` | Review payload | Updated MedicationRequest |
| `GET /api/students/:studentId/medication-history` | `medication_request.read` | Standard pagination plus `status?`, `fromDate?`, `toDate?` | Paginated medication detail/history |

Review payload:

```ts
type ReviewMedicationRequest = {
  action: "APPROVE" | "REJECT" | "NEEDS_MORE_INFO";
  note?: string | null; // max 4000
};
```

Only a `SUBMITTED` request can be reviewed. Approval materializes administration occurrences for every request item/date/time. A guardian response is accepted only while `NEEDS_MORE_INFO` and moves the request back to `SUBMITTED`. Guardian cancellation is accepted only while `SUBMITTED` or `NEEDS_MORE_INFO`.

### 3.5 Medication administration endpoints

| Method and path | Required permission | Request/query | Response |
| --- | --- | --- | --- |
| `GET /api/medication-administrations/daily` | `medication_administration.read` | `date?`, `classId?`, `studentId?`, `status?` | Daily queue array |
| `POST /api/medication-administrations/:occurrenceId/record` | First record: `medication_administration.create`; correction: `medication_administration.update` | Record payload | Updated latest summary and appended log |

`date` defaults to campus-local today. `status` is one of `DUE`, `OVERDUE`, `GIVEN`, `SKIPPED`, `REFUSED`, or `ABSENT`.

Record/correct payload:

```ts
type RecordMedicationAdministration = {
  outcome: "GIVEN" | "SKIPPED" | "REFUSED" | "ABSENT";
  actualTime?: string | null;        // HH:mm
  note?: string | null;              // max 4000
  correctionOfLogId?: string | null; // UUID of current latest log
};
```

For the first record, omit `correctionOfLogId`. To correct an outcome, send the queue/detail item’s current `latestLogId` as `correctionOfLogId`. Corrections append a new log; history is not overwritten.

Example correction:

```http
POST /api/medication-administrations/55555555-5555-4555-a555-555555555555/record
Authorization: Bearer <token>
x-campus-id: 11111111-1111-4111-a111-111111111111
Content-Type: application/json

{
  "outcome": "GIVEN",
  "actualTime": "12:35",
  "note": "Corrected after confirming with nurse.",
  "correctionOfLogId": "66666666-6666-4666-a666-666666666666"
}
```

If the log ID is stale, the backend returns `409`; refetch the occurrence and do not retry blindly.

## 4. Data model and field details

### 4.1 Health archive fields shared by checkup, instruction, and event

```ts
type ArchiveFields = {
  archivedAt: string | null;
  archivedByUserId: string | null;
  isArchived: boolean; // always archivedAt !== null
};
```

`archivedByUserId` may be `null` on an archived record if the actor user was later deleted; the append-only audit entry remains the durable actor record. Use `isArchived` or `archivedAt`, not the actor ID, to decide archive state.

### 4.2 Checkup

Create request:

```ts
type CreateHealthCheckup = {
  checkupType?: "GENERAL" | "GROWTH" | "VISION" | "OTHER"; // default GENERAL
  checkedAt: string;          // required ISO timestamp; cannot be in the future
  heightCm?: number | null;   // > 0 when present
  weightKg?: number | null;   // > 0 when present
  notes?: string | null;
};
```

At least one meaningful value among height, weight, or non-blank notes is required. `PATCH` accepts the same fields as optional but must contain at least one field and must leave a valid meaningful record.

Response fields:

```ts
type HealthCheckup = ArchiveFields & {
  id: string;
  studentId: string;
  campusId: string;
  checkupType: "GENERAL" | "GROWTH" | "VISION" | "OTHER";
  checkedAt: string;
  heightCm: number | null;
  weightKg: number | null;
  notes: string | null;
  recordedBy: { id: string; fullName: string | null } | null;
  lastUpdatedBy: { id: string; fullName: string | null } | null;
  createdAt: string;
  updatedAt: string;
};
```

BMI and percentile fields are not part of this contract.

### 4.3 Health instruction

Create request:

```ts
type CreateHealthInstruction = {
  instructionType: "MEDICATION" | "CARE" | "DIET" | "ACTIVITY" | "OTHER";
  title: string;
  instruction: string;
  dosage?: string | null;
  startDate: string;              // YYYY-MM-DD
  endDate?: string | null;        // YYYY-MM-DD and >= startDate
  timesOfDay?: string[];          // unique HH:mm; default []
  scheduleNotes?: string | null;
  notes?: string | null;
  isActive?: boolean;             // default true
};
```

`PATCH` accepts a non-empty subset. Response adds all IDs/timestamps/archive fields plus:

```ts
type HealthInstructionFields = {
  instructionType: "MEDICATION" | "CARE" | "DIET" | "ACTIVITY" | "OTHER";
  title: string;
  instruction: string;
  dosage: string | null;
  startDate: string;
  endDate: string | null;
  timesOfDay: string[];
  scheduleNotes: string | null;
  notes: string | null;
  isActive: boolean;
  status: "UPCOMING" | "ACTIVE" | "EXPIRED" | "INACTIVE"; // derived for reference date
  createdBy: { id: string; fullName: string | null } | null;
  lastUpdatedBy: { id: string; fullName: string | null } | null;
};
```

The active-student response is a compact shape:

```ts
type ActiveStudentInstructions = {
  studentId: string;
  campusId: string;
  date: string;
  instructions: Array<{
    id: string;
    instructionType: HealthInstructionFields["instructionType"];
    title: string;
    instruction: string;
    dosage: string | null;
    timesOfDay: string[];
    scheduleNotes: string | null;
    status: "ACTIVE";
  }>;
};
```

### 4.4 Health event

Create request:

```ts
type CreateHealthEvent = {
  eventType: "ILLNESS" | "INJURY" | "SYMPTOM" | "OBSERVATION" | "OTHER";
  category?: "EYE" | "ENT" | "RESPIRATORY" | "SKIN" | "DIGESTIVE" |
             "CARDIAC" | "NEUROLOGICAL" | "MOBILITY" | "OTHER" | null;
  title: string;
  description?: string | null;
  occurredAt: string;             // required ISO timestamp; cannot be future
  status: "OPEN" | "RESOLVED";
  resolutionNotes?: string | null;
};
```

`PATCH` accepts a non-empty subset. Response adds IDs/timestamps/archive fields, `recordedBy`, and `lastUpdatedBy`. `ARCHIVED` must be removed from frontend event-status types, filters, badges, and forms.

### 4.5 Medication request

```ts
type MedicationRequestStatus =
  | "SUBMITTED"
  | "NEEDS_MORE_INFO"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED"
  | "EXPIRED";

type MedicationRequest = {
  id: string;
  campusId: string;
  studentId: string;
  student: { id: string; fullName: string; studentCode: string | null } | null;
  requesterGuardianId: string;
  requesterGuardian: {
    id: string;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
  } | null;
  status: MedicationRequestStatus;
  startDate: string;
  endDate: string;
  reason: string | null;
  parentNotes: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  items: MedicationRequestItem[];
  timelineEntries: MedicationTimelineEntry[];
  createdAt: string;
  updatedAt: string;
};
```

`completedAt` is non-null only for `COMPLETED`; `expiredAt` is non-null only for `EXPIRED`. Existing legacy terminal rows were backfilled from `updatedAt`, so those historical values are the best available timestamp rather than a reconstructed exact boundary.

Request items expose `id`, `medicationName`, nullable `dosage`, `instructions`, `timesOfDay`, nullable `scheduleNotes`, nullable `notes`, `createdAt`, and `updatedAt`.

Timeline entries expose:

```ts
type MedicationTimelineEntry = {
  id: string;
  requestId: string;
  campusId: string;
  actorType: "GUARDIAN" | "STAFF" | "SYSTEM";
  actorUserId: string | null;
  actorGuardianId: string | null;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO" |
          "CANCELLED" | "PARENT_RESPONDED" | "COMPLETED" | "EXPIRED";
  note: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Staff and parent detail responses additionally expose `occurrences`; staff detail also exposes nullable `reviewedByUser`.

### 4.6 Medication occurrence, logs, and daily queue

Occurrence detail fields are:

```ts
type MedicationOccurrence = {
  id: string;
  requestId: string;
  medicationItemId: string;
  campusId: string;
  studentId: string;
  dueDate: string; // campus date
  dueTime: string; // campus HH:mm
  latestOutcome: "GIVEN" | "SKIPPED" | "REFUSED" | "ABSENT" | null;
  latestLogId: string | null;
  latestRecordedAt: string | null;
  latestRecordedByUserId: string | null;
  latestNote: string | null;
  logs: MedicationAdministrationLog[];
  createdAt: string;
  updatedAt: string;
};
```

Logs expose `id`, `occurrenceId`, `outcome`, `recordedByUserId`, nullable `recordedByUser`, `recordedAt`, nullable `actualTime`, nullable `note`, nullable `correctionOfLogId`, `createdAt`, and `updatedAt`.

Daily queue items expose `occurrenceId`, `requestId`, `medicationItemId`, student summary, nullable class summary, medication name/dosage/instructions, due date/time, derived `status`, `isOverdue`, nullable parent notes, nullable latest log, latest summary fields, and timestamps.

## 5. Business logic handled by the backend

### Health validation and archive behavior

- Verifies campus and student ownership at the repository/use-case boundary.
- Rejects writes for archived students.
- Validates UUIDs, strict dates, enums, positive metrics, meaningful checkup content, instruction date order, unique `HH:mm` values, non-empty patches, and event timestamps that are not in the future.
- Defaults checkup type to `GENERAL`, instruction `timesOfDay` to `[]`, and instruction `isActive` to `true`.
- Excludes archived health records from ordinary lists unless `includeArchived=true`.
- Always excludes archived records from active student/class instructions, Health Center daily items, and open-event operational counts.
- Allows archived detail reads for users with read permission.
- Rejects archived updates and update/archive race losers with `409`.
- Performs archive through a conditional database write. Sequential or concurrent duplicate archives preserve the first archive metadata and emit only one audit event.
- Rejects first-time archive of an active record when its owning student is already archived, but an already-archived record remains idempotently readable/re-archivable after the student is archived.

### Medication lifecycle and state transitions

```text
SUBMITTED --staff approve--> APPROVED --system boundary--> COMPLETED
SUBMITTED --staff reject---------------------------------> REJECTED
SUBMITTED --needs info--> NEEDS_MORE_INFO --parent reply--> SUBMITTED
SUBMITTED or NEEDS_MORE_INFO --parent cancel-------------> CANCELLED
SUBMITTED or NEEDS_MORE_INFO --expiration boundary-------> EXPIRED
```

`REJECTED`, `CANCELLED`, `COMPLETED`, and `EXPIRED` are terminal. Staff review, parent response, and parent cancellation against these states return `409`. An otherwise nonterminal but invalid command state, such as trying to review `APPROVED`, returns `400`.

For `SUBMITTED` or `NEEDS_MORE_INFO`, expiration eligibility begins at the first instant of the campus-local day after `endDate`. For `APPROVED`, completion eligibility begins at the final materialized occurrence’s campus-local due instant. If an approved legacy/anomalous request has no occurrences, the fallback is the start of the campus-local day after `endDate`.

The reconciler:

- runs every five minutes;
- scans at most `MEDICATION_LIFECYCLE_RECONCILIATION_LIMIT`, default `100`, per run;
- uses conditional updates and atomic SYSTEM timeline writes;
- is safe for concurrent application replicas;
- records the effective boundary in `completedAt`/`expiredAt`;
- does not write administration outcomes;
- does not mutate status during reads.

The command guard captures one `now`. If a review/response/cancel reaches an expired active request before the cron has persisted it, the backend first commits the one-time `EXPIRED` transition and SYSTEM timeline entry, then returns `409`. The frontend should refetch after that conflict.

Approval materializes occurrences using campus-local dates/times. For daylight saving transitions, nonexistent spring-forward wall times shift forward to the next valid instant; repeated fall-back wall times use the earlier instant. The browser should not reproduce this calculation.

Missing administration outcomes do not block `COMPLETED`. Existing occurrences remain visible, recordable, and correctable after request completion.

### Permissions handled by backend

Active health permissions are `student_health.read`, `student_health.create`, `student_health.update`, and `student_health.delete`.

Active medication permissions are:

- `medication_request.list`
- `medication_request.read`
- `medication_request.update`
- `medication_administration.read`
- `medication_administration.create`
- `medication_administration.update`

The backend enforces exact first-record versus correction permission at use-case level even though the route-level guard permits entry with either administration write permission.

The retired permission IDs are:

- `medication_request.create`
- `medication_request.delete`
- `medication_administration.list`

Do not display or submit retired IDs in role-management UI.

## 6. Business logic the frontend still needs to handle

- Add `timeZone` as a required campus-create form field and an editable campus field. Use an IANA timezone selector; still render backend `400` validation messages.
- Preserve date-only and `HH:mm` strings as campus values. Do not construct medication completion/expiration instants in the browser.
- Remove `ARCHIVED` from event status models and UI. Archive state comes from `isArchived`/`archivedAt`.
- Treat health archive as a retained record. On successful `DELETE`, update the row with the returned data or refetch; do not assume the resource disappeared globally.
- Show archive actions only for users with `student_health.delete`. Do not use `student_health.update` as a substitute.
- Send literal query strings `true` or `false` for `includeArchived`; omit it for normal active-only screens and Health Snapshot.
- Keep the existing Health Snapshot list call and handle an empty `data` array.
- Disable edit controls for archived health records, but still handle `409` because another user may archive after the screen loads.
- Add `COMPLETED` and `EXPIRED` labels, filters, colors, and terminal-state behavior. Consume the server timestamps instead of calculating them.
- After a medication command returns `409`, refetch request/detail/timeline before showing the final state. A late command may have committed `EXPIRED` even though the requested action failed.
- Do not disable medication administration solely because the request is `COMPLETED`; its occurrences remain actionable.
- For corrections, always use the freshly fetched `latestLogId`. On stale `409`, refetch and ask the user to review the newer outcome.
- For screens that depend on a particular calendar day, send an explicit `date=YYYY-MM-DD`. Health Center defaults are campus-local; the existing student/class active-instruction endpoints currently derive an omitted date from the process current date, so explicit dates avoid boundary ambiguity.
- Treat nullable actor/user/student/guardian/class and latest-log fields as normal. Render an “unknown/deleted user” fallback instead of assuming nested objects exist.
- Treat Health Center summary `links` as UI route hints only, not fetch URLs.
- Continue frontend form validation for usability, but do not assume hidden buttons or client validation provide authorization or consistency; backend validation remains authoritative.

## 7. Known issues, rollout requirements, and follow-ups

### Required before environment use

The code was verified but not deployed and no live database was migrated by this work. Deployment must run migrations before the seed:

```bash
npm run prisma:migrate:deploy
npx prisma db seed
```

The order matters: migrations add/backfill timezone/archive/terminal fields and remove obsolete permission rows; the seed adds `student_health.delete` and synchronizes the current permission catalog. Application startup does not run the seed automatically.

Existing campuses are backfilled to `Asia/Ho_Chi_Minh`. Confirm that value is correct for each real campus after deployment and update campuses that operate elsewhere.

### Known limitations and risks

- There is no health-record restore endpoint in this scope.
- Lifecycle persistence is asynchronous by up to roughly five minutes when no guarded command occurs. Reads intentionally do not mutate status. A passive screen can briefly show the last persisted status until reconciliation/refetch.
- Existing `COMPLETED`/`EXPIRED` rows use historical `updatedAt` as their backfilled terminal timestamp because an exact old boundary was not available.
- Changing a campus timezone changes subsequent interpretation of persisted local schedules. The backend does not rewrite stored date-only or minute values. Campus timezone changes should therefore be deliberate and may merit a frontend confirmation message.
- Student/class active-instruction endpoints accept optional `date`, but their omitted-date behavior is not explicitly campus-timezone-resolved like Health Center defaults. Send an explicit date for deterministic day-specific screens.
- Swagger is available at `/docs` only outside production.
- No medication-to-health-instruction/event automation was added. Do not expect medication approval/completion/expiration to appear as a health event or instruction.
- No attachment workflow or broad medication workflow expansion was included.

## 8. Backend source and specification references

The canonical backend specification is:

`/Users/hvu/Desktop/Cod/kindercare_backend/.knowns/docs/specs/2026-07-14/student-health-and-medication-lifecycle-backend.md`

Primary HTTP contracts:

- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/campus.controller.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/student-health.controller.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/class-health-instructions.controller.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/health-center.controller.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/health-center-medication-summary.controller.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/medication-request.controller.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/parent-medication-request.controller.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/medication-administration.controller.ts`

Primary request/response DTO directories:

- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/dtos/campus`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/dtos/student-health`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/dtos/medication`

Lifecycle/timezone implementation:

- `/Users/hvu/Desktop/Cod/kindercare_backend/src/application/medication/medication-time-boundaries.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/application/medication/use-cases/medication-request-command.guard.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/application/medication/use-cases/reconcile-medication-request-lifecycle.use-case.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/infra/cronjob/tasks/medication-lifecycle-reconciliation.task.ts`
- `/Users/hvu/Desktop/Cod/kindercare_backend/src/core/time`

Database and permission rollout:

- `/Users/hvu/Desktop/Cod/kindercare_backend/prisma/schema.prisma`
- `/Users/hvu/Desktop/Cod/kindercare_backend/prisma/migrations/20260714170000_add_campus_timezone/migration.sql`
- `/Users/hvu/Desktop/Cod/kindercare_backend/prisma/migrations/20260714171000_add_student_health_archive_metadata/migration.sql`
- `/Users/hvu/Desktop/Cod/kindercare_backend/prisma/migrations/20260714172000_add_medication_terminal_timestamps/migration.sql`
- `/Users/hvu/Desktop/Cod/kindercare_backend/prisma/migrations/20260714173000_remove_obsolete_medication_permissions/migration.sql`
- `/Users/hvu/Desktop/Cod/kindercare_backend/prisma/seed.ts`
