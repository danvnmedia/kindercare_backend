---
title: Student Profile Health Tab Backend
description: 'Backend specification for Student Profile Health V1: health profile snapshot, checkups, health instructions for teachers, and health history events.'
createdAt: '2026-06-30T19:01:32.157Z'
updatedAt: '2026-07-10T22:05:08.460Z'
tags:
  - spec
  - approved
  - student-health
  - student-profile
  - backend
  - api
---

# Student Profile Health Tab Backend

## Overview

Build backend support for the V1 Student Profile Health tab and teacher-facing active health instructions.

V1 focuses on operational health information that campus staff need to know or maintain for a student:

- allergies
- restrictions or things the student must avoid
- medical/health conditions such as eye, respiratory, skin, digestive, or other issues
- care or medication instructions that teachers may need to follow during the day
- checkup/growth measurement records
- health history events for "what happened to the student" over time

This is a backend spec. Frontend research is used only to shape the API surface for the Student Profile Health tab and teacher active-instruction view.

V1 explicitly does not include parent medical request submission, enrollment health intake links, medical documents/attachments, or medication administration logging.

Supporting research:

- @doc/archive/research/student-profile-health-tab-fullstack-research
- @doc/archive/research/student-health-management-backend-research
- @doc/archive/frontend-handoff/student-health-management-frontend-handoff

## Locked Decisions

- D1: V1 starts with backend support for the staff-facing Student Profile Health tab plus teacher-facing active instruction reads. Parent medical requests, intake links, documents, and medication administration actions are out of scope.
- D2: Health data is current-campus scoped in V1. The API uses the selected campus context and does not provide cross-campus health continuity.
- D3: V1 supports writes: update the health snapshot, create/update checkups, create/update health instructions, and create/update health history events.
- D4: Add a separate `StudentHealthProfile` model with a one-to-one relationship to `Student`. Do not add medical fields directly to `Student`.
- D5: The health profile snapshot uses structured arrays for allergies, restrictions, and conditions, plus nullable emergency notes.
- D6: Checkup records can be updated but cannot be deleted in V1.
- D7: Add RBAC permissions under module `student_health`: `student_health.read`, `student_health.create`, and `student_health.update`.
- D8: Use resource-specific endpoints rather than a single aggregate `health-tab` endpoint.
- D9: Checkup measurements use canonical metric fields: `heightCm` and `weightKg`.
- D10: BMI, BMI percentile, growth percentile, and growth interpretation are out of scope. Backend must not calculate or return them in V1.
- D11: `GET /students/:studentId/health-profile` returns a stable empty profile shape when no health profile exists yet.
- D12: Medication/care instructions are a separate resource, `StudentHealthInstruction`, because teachers need an active daily read model.
- D13: Teacher-facing V1 is read-only active instruction visibility. It does not include "given", "skipped", "missed", or other medication administration actions.
- D14: Health history is a separate resource, `StudentHealthEvent`, for events such as illness, injury, symptoms, or staff observations.
- D15: Roles are not hard-coded. Any user with the relevant `student_health` permission can perform the corresponding action.
- D16: Health instruction status is backend-derived as `UPCOMING`, `ACTIVE`, `EXPIRED`, or `INACTIVE`.
- D17: V1 includes both student-level and class-level active instruction read endpoints.
- D18: Health history events use simple status values: `OPEN`, `RESOLVED`, and `ARCHIVED`.
- D19: Medical documents/attachments are out of scope for V1.

## API Contract

All endpoints below use the existing backend API conventions:

- Base path includes the existing global API prefix, for example `/api` when configured.
- Requests require Clerk authentication.
- Campus-scoped endpoints require the selected campus context, normally via `X-Campus-Id`.
- Responses are wrapped in the standard backend response envelope.
- `student_health.read` is required for reads.
- `student_health.create` is required for creates.
- `student_health.update` is required for updates.

### Health Profile

#### GET `/api/students/:studentId/health-profile`

Returns the current-campus health profile snapshot for a student. If no profile exists, backend creates or initializes an empty profile shape and returns `200`.

Required permission: `student_health.read`.

Response data:

```json
{
  "id": "profile_uuid",
  "studentId": "student_uuid",
  "campusId": "campus_uuid",
  "allergies": [],
  "conditions": [],
  "restrictions": [],
  "emergencyNotes": null,
  "lastUpdatedAt": null,
  "lastUpdatedBy": null,
  "createdAt": "2026-07-01T08:00:00.000Z",
  "updatedAt": "2026-07-01T08:00:00.000Z"
}
```

Example response with data:

```json
{
  "id": "profile_uuid",
  "studentId": "student_uuid",
  "campusId": "campus_uuid",
  "allergies": [
    {
      "name": "Peanuts",
      "severity": "SEVERE",
      "reaction": "Rash and breathing difficulty",
      "notes": "Avoid peanut snacks."
    }
  ],
  "conditions": [
    {
      "category": "EYE",
      "name": "Near-sightedness",
      "status": "MONITORING",
      "notes": "Wears glasses in class."
    }
  ],
  "restrictions": [
    {
      "type": "FOOD",
      "description": "No tree nuts",
      "notes": null
    }
  ],
  "emergencyNotes": "Carry inhaler if outdoor activity is intense.",
  "lastUpdatedAt": "2026-07-01T09:15:00.000Z",
  "lastUpdatedBy": {
    "id": "user_uuid",
    "fullName": "School Nurse"
  },
  "createdAt": "2026-07-01T08:00:00.000Z",
  "updatedAt": "2026-07-01T09:15:00.000Z"
}
```

#### PATCH `/api/students/:studentId/health-profile`

Updates the current-campus health profile snapshot.

Required permission: `student_health.update`.

Request payload fields are optional, but at least one updatable field is required. If an array is provided, it replaces that full array. If an array is omitted, the existing value remains unchanged. `emergencyNotes: null` clears emergency notes.

```json
{
  "allergies": [
    {
      "name": "Peanuts",
      "severity": "SEVERE",
      "reaction": "Rash and breathing difficulty",
      "notes": "Avoid peanut snacks."
    }
  ],
  "conditions": [
    {
      "category": "EYE",
      "name": "Near-sightedness",
      "status": "MONITORING",
      "notes": "Wears glasses in class."
    }
  ],
  "restrictions": [
    {
      "type": "FOOD",
      "description": "No tree nuts",
      "notes": null
    }
  ],
  "emergencyNotes": "Carry inhaler if outdoor activity is intense."
}
```

Response data: updated health profile response.

### Health Checkups

#### GET `/api/students/:studentId/health-checkups`

Lists checkup records for a student in the current campus.

Required permission: `student_health.read`.

Query params should follow the existing pagination/sorting conventions where possible. Recommended initial filters:

- `offset`
- `limit`
- `sort`
- `filter`

Response data should be paginated using the existing standard pagination shape.

Checkup item shape:

```json
{
  "id": "checkup_uuid",
  "studentId": "student_uuid",
  "campusId": "campus_uuid",
  "checkupType": "GENERAL",
  "checkedAt": "2026-07-01T09:00:00.000Z",
  "heightCm": 108.5,
  "weightKg": 18.6,
  "notes": "Routine measurement.",
  "recordedBy": {
    "id": "user_uuid",
    "fullName": "School Nurse"
  },
  "lastUpdatedBy": null,
  "createdAt": "2026-07-01T09:05:00.000Z",
  "updatedAt": "2026-07-01T09:05:00.000Z"
}
```

#### POST `/api/students/:studentId/health-checkups`

Creates a checkup record.

Required permission: `student_health.create`.

```json
{
  "checkupType": "GENERAL",
  "checkedAt": "2026-07-01T09:00:00.000Z",
  "heightCm": 108.5,
  "weightKg": 18.6,
  "notes": "Routine measurement."
}
```

Response data: created checkup item.

#### GET `/api/students/:studentId/health-checkups/:checkupId`

Returns one checkup record.

Required permission: `student_health.read`.

Response data: checkup item.

#### PATCH `/api/students/:studentId/health-checkups/:checkupId`

Updates a checkup record. V1 supports update but not delete.

Required permission: `student_health.update`.

Request payload fields are optional, but at least one updatable field is required.

```json
{
  "checkedAt": "2026-07-01T09:30:00.000Z",
  "heightCm": 109,
  "weightKg": 18.8,
  "notes": "Corrected measurement after re-check."
}
```

Response data: updated checkup item.

### Health Instructions

Health instructions cover daily care or medication notes that teachers and staff need to know, such as "give medicine at 10:00" or "avoid intense outdoor activity".

#### GET `/api/students/:studentId/health-instructions`

Lists all instructions for a student in the current campus.

Required permission: `student_health.read`.

Recommended query params:

- `offset`
- `limit`
- `sort`
- `filter`
- `status` optional derived-status filter: `UPCOMING`, `ACTIVE`, `EXPIRED`, `INACTIVE`
- `date` optional `YYYY-MM-DD` reference date used for derived status calculation

Instruction item shape:

```json
{
  "id": "instruction_uuid",
  "studentId": "student_uuid",
  "campusId": "campus_uuid",
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
```

#### POST `/api/students/:studentId/health-instructions`

Creates a health instruction.

Required permission: `student_health.create`.

```json
{
  "instructionType": "MEDICATION",
  "title": "Antibiotic after lunch",
  "instruction": "Give the medication after lunch with water.",
  "dosage": "5 ml",
  "startDate": "2026-07-01",
  "endDate": "2026-07-05",
  "timesOfDay": ["12:30"],
  "scheduleNotes": "After lunch only.",
  "notes": "Call guardian if vomiting occurs.",
  "isActive": true
}
```

Response data: created instruction item with derived `status`.

#### GET `/api/students/:studentId/health-instructions/active`

Returns active instructions for one student for a date.

Required permission: `student_health.read`.

Query params:

- `date`: optional `YYYY-MM-DD`. If omitted, backend uses the server current date. Frontend should prefer sending an explicit date for teacher daily views.

Response data:

```json
{
  "studentId": "student_uuid",
  "campusId": "campus_uuid",
  "date": "2026-07-01",
  "instructions": [
    {
      "id": "instruction_uuid",
      "instructionType": "MEDICATION",
      "title": "Antibiotic after lunch",
      "instruction": "Give the medication after lunch with water.",
      "dosage": "5 ml",
      "timesOfDay": ["12:30"],
      "scheduleNotes": "After lunch only.",
      "status": "ACTIVE"
    }
  ]
}
```

#### GET `/api/students/:studentId/health-instructions/:instructionId`

Returns one instruction.

Required permission: `student_health.read`.

Response data: instruction item.

#### PATCH `/api/students/:studentId/health-instructions/:instructionId`

Updates an instruction.

Required permission: `student_health.update`.

Request payload fields are optional, but at least one updatable field is required.

```json
{
  "endDate": "2026-07-06",
  "timesOfDay": ["12:30", "16:00"],
  "scheduleNotes": "After lunch and before pickup."
}
```

Response data: updated instruction item with derived `status`.

### Class Active Health Instructions

#### GET `/api/classes/:classId/health-instructions/active`

Returns active instructions for students in a class on a selected date. This endpoint is for teacher daily visibility only. It does not create administration events and does not mark instructions as given or skipped.

Required permission: `student_health.read`.

Query params:

- `date`: optional `YYYY-MM-DD`. If omitted, backend uses the server current date. Frontend should prefer sending an explicit date.

Response data:

```json
{
  "classId": "class_uuid",
  "campusId": "campus_uuid",
  "date": "2026-07-01",
  "items": [
    {
      "student": {
        "id": "student_uuid",
        "fullName": "Nguyen An",
        "studentCode": "STU001"
      },
      "instructions": [
        {
          "id": "instruction_uuid",
          "instructionType": "MEDICATION",
          "title": "Antibiotic after lunch",
          "instruction": "Give the medication after lunch with water.",
          "dosage": "5 ml",
          "timesOfDay": ["12:30"],
          "scheduleNotes": "After lunch only.",
          "status": "ACTIVE"
        }
      ]
    }
  ]
}
```

### Health History Events

#### GET `/api/students/:studentId/health-events`

Lists health history events for a student in the current campus.

Required permission: `student_health.read`.

Recommended query params:

- `offset`
- `limit`
- `sort`
- `filter`
- `status`: optional `OPEN`, `RESOLVED`, `ARCHIVED`
- `eventType`: optional event type filter

Event item shape:

```json
{
  "id": "event_uuid",
  "studentId": "student_uuid",
  "campusId": "campus_uuid",
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
```

#### POST `/api/students/:studentId/health-events`

Creates a health history event.

Required permission: `student_health.create`.

```json
{
  "eventType": "ILLNESS",
  "category": "EYE",
  "title": "Eye redness observed",
  "description": "Teacher noticed redness in the left eye after nap time.",
  "occurredAt": "2026-07-01T14:00:00.000Z",
  "status": "OPEN"
}
```

Response data: created event item.

#### GET `/api/students/:studentId/health-events/:eventId`

Returns one health history event.

Required permission: `student_health.read`.

Response data: event item.

#### PATCH `/api/students/:studentId/health-events/:eventId`

Updates a health history event, including status transitions.

Required permission: `student_health.update`.

```json
{
  "status": "RESOLVED",
  "resolutionNotes": "Guardian picked up student and confirmed follow-up with doctor."
}
```

Response data: updated event item.

## Data Model And Field Details

### `StudentHealthProfile`

Recommended persistence fields:

- `id`: UUID, required.
- `campusId`: UUID, required. Must match the selected campus and the student's campus.
- `studentId`: UUID, required, unique. One profile per student in V1.
- `allergies`: typed structured array, required, default `[]`.
- `conditions`: typed structured array, required, default `[]`.
- `restrictions`: typed structured array, required, default `[]`.
- `emergencyNotes`: string nullable.
- `lastUpdatedByUserId`: UUID nullable.
- `createdAt`: DateTime.
- `updatedAt`: DateTime.

Allergy item:

```ts
type StudentHealthAllergy = {
  name: string;
  severity: "MILD" | "MODERATE" | "SEVERE" | "UNKNOWN";
  reaction?: string | null;
  notes?: string | null;
};
```

Restriction item:

```ts
type StudentHealthRestriction = {
  type: "FOOD" | "ACTIVITY" | "MEDICATION" | "ENVIRONMENT" | "OTHER";
  description: string;
  notes?: string | null;
};
```

Condition item:

```ts
type StudentHealthCondition = {
  category: "EYE" | "ENT" | "RESPIRATORY" | "SKIN" | "DIGESTIVE" | "CARDIAC" | "NEUROLOGICAL" | "MOBILITY" | "OTHER";
  name: string;
  status: "ACTIVE" | "MONITORING" | "RESOLVED" | "UNKNOWN";
  notes?: string | null;
};
```

### `StudentHealthCheckup`

Fields:

- `id`: UUID, required.
- `campusId`: UUID, required.
- `studentId`: UUID, required.
- `checkupType`: enum, required, default `GENERAL`.
- `checkedAt`: DateTime, required.
- `heightCm`: decimal nullable.
- `weightKg`: decimal nullable.
- `notes`: string nullable.
- `recordedByUserId`: UUID nullable.
- `lastUpdatedByUserId`: UUID nullable.
- `createdAt`: DateTime.
- `updatedAt`: DateTime.

Checkup type enum:

- `GENERAL`
- `GROWTH`
- `VISION`
- `OTHER`

Rules:

- At least one of `heightCm`, `weightKg`, or `notes` is required on create.
- `heightCm` and `weightKg` must be positive if provided.
- Backend must not calculate or return BMI/percentile fields.
- Delete is not supported in V1.

### `StudentHealthInstruction`

Fields:

- `id`: UUID, required.
- `campusId`: UUID, required.
- `studentId`: UUID, required.
- `instructionType`: enum, required.
- `title`: string, required.
- `instruction`: string, required.
- `dosage`: string nullable.
- `startDate`: date-only string, required.
- `endDate`: date-only string nullable.
- `timesOfDay`: string array, required, default `[]`, values must be `HH:mm`.
- `scheduleNotes`: string nullable.
- `notes`: string nullable.
- `isActive`: boolean, required, default `true`.
- `createdByUserId`: UUID nullable.
- `lastUpdatedByUserId`: UUID nullable.
- `createdAt`: DateTime.
- `updatedAt`: DateTime.

Instruction type enum:

- `MEDICATION`
- `CARE`
- `DIET`
- `ACTIVITY`
- `OTHER`

Derived instruction status:

- `INACTIVE`: `isActive` is false.
- `UPCOMING`: active flag is true and reference date is before `startDate`.
- `ACTIVE`: active flag is true, reference date is on or after `startDate`, and `endDate` is null or on/after the reference date.
- `EXPIRED`: active flag is true and `endDate` is before the reference date.

### `StudentHealthEvent`

Fields:

- `id`: UUID, required.
- `campusId`: UUID, required.
- `studentId`: UUID, required.
- `eventType`: enum, required.
- `category`: condition category enum nullable.
- `title`: string, required.
- `description`: string nullable.
- `occurredAt`: DateTime, required.
- `status`: enum, required, default `OPEN`.
- `resolutionNotes`: string nullable.
- `recordedByUserId`: UUID nullable.
- `lastUpdatedByUserId`: UUID nullable.
- `createdAt`: DateTime.
- `updatedAt`: DateTime.

Event type enum:

- `ILLNESS`
- `INJURY`
- `SYMPTOM`
- `OBSERVATION`
- `OTHER`

Event status enum:

- `OPEN`
- `RESOLVED`
- `ARCHIVED`

## Validation And Business Rules

### Campus And Student Scope

- Every endpoint must require a selected campus context.
- `studentId` must belong to the selected campus.
- Class active-instruction endpoint must verify `classId` belongs to the selected campus.
- Class active-instruction endpoint must only include students actively enrolled in that class according to existing class/enrollment rules.
- V1 must not return health data from other campuses.

### Permissions

- Reads require `student_health.read`.
- Creates require `student_health.create`.
- Updates require `student_health.update`.
- Permission checks are role-agnostic. Teachers, nurses, admins, or any other role can act only when their campus role includes the required permission.
- Do not reuse `student.read` or `student.update` for health data.

### Archived Students

- Read endpoints may return data for an archived student if the user has `student_health.read` and campus access.
- Write endpoints must reject updates/creates for archived students unless a future product decision explicitly allows archived health mutations.

### Health Profile

- `GET` must return a stable empty profile shape when no profile exists.
- Arrays default to `[]`.
- `emergencyNotes` defaults to `null`.
- `PATCH` must reject an empty payload.
- Unknown fields must be rejected by DTO validation.
- Array item values must be trimmed.
- Required item fields must be non-empty after trim.

### Checkups

- `checkedAt` is required on create.
- `heightCm` and `weightKg` are optional but must be positive when present.
- At least one meaningful value is required: `heightCm`, `weightKg`, or `notes`.
- Future-dated checkups are rejected in V1 unless product later adds scheduled checkups.
- Update must audit before/after values.
- Delete is not available in V1.

### Health Instructions

- `title`, `instruction`, and `startDate` are required.
- `endDate`, when provided, must be on or after `startDate`.
- `timesOfDay` entries must use `HH:mm` 24-hour format.
- `timesOfDay` should be normalized and sorted ascending in responses.
- `status` is derived by backend and cannot be set directly by the client.
- `isActive` can be updated to make an instruction `INACTIVE` without deleting it.
- Active instruction endpoints return only `ACTIVE` instructions for the reference date.

### Health Events

- `title`, `eventType`, `occurredAt`, and `status` are required on create.
- `occurredAt` cannot be in the future in V1.
- `resolutionNotes` is optional, but recommended when status changes to `RESOLVED`.
- `ARCHIVED` is not deletion; archived events remain auditable.

## Error Responses

Use existing backend exception/response conventions. Required error cases:

- `400 Bad Request`: invalid UUID, invalid enum, invalid date/time format, empty PATCH payload, unknown fields, invalid measurements, invalid schedule.
- `401 Unauthorized`: missing or invalid authentication.
- `403 Forbidden`: missing campus access or missing required `student_health.*` permission.
- `404 Not Found`: student, class, checkup, instruction, or event does not exist in the selected campus.
- `409 Conflict`: write attempted against archived student, cross-campus mismatch detected, or invalid state transition.

Frontend-facing error messages should be specific enough to distinguish validation, permission, not-found, and archived-student cases.

## Acceptance Criteria

- [ ] AC-1: Backend adds `student_health.read`, `student_health.create`, and `student_health.update` to the system permission catalog.
- [ ] AC-2: Health endpoints require authenticated access, selected campus context, campus scoping, and the relevant `student_health` permission.
- [ ] AC-3: `GET /students/:studentId/health-profile` returns a stable empty profile shape for a student with no existing profile.
- [ ] AC-4: `PATCH /students/:studentId/health-profile` updates structured allergies, conditions, restrictions, and emergency notes without touching ordinary `Student` fields.
- [ ] AC-5: Health profile data is current-campus scoped and cannot be read or written through a different selected campus.
- [ ] AC-6: Backend can create, list, read, and update checkup records for a student.
- [ ] AC-7: Checkup records store `heightCm` and `weightKg` as metric values and do not include BMI/percentile fields.
- [ ] AC-8: Checkup delete is not exposed in V1.
- [ ] AC-9: Backend can create, list, read, and update health instructions for a student.
- [ ] AC-10: Backend derives instruction status as `UPCOMING`, `ACTIVE`, `EXPIRED`, or `INACTIVE` from `isActive`, `startDate`, `endDate`, and reference date.
- [ ] AC-11: Student active-instruction endpoint returns only active instructions for the requested student/date.
- [ ] AC-12: Class active-instruction endpoint returns active instructions grouped by active students in the selected class/date.
- [ ] AC-13: Teacher-facing active instruction endpoints are read-only and do not create administration logs.
- [ ] AC-14: Backend can create, list, read, and update health history events with `OPEN`, `RESOLVED`, and `ARCHIVED` statuses.
- [ ] AC-15: Writes to profile, checkups, instructions, and events emit audit records with actor and before/after values where existing audit infrastructure supports it.
- [ ] AC-16: Write endpoints reject archived students in V1.
- [ ] AC-17: Medical documents, parent medical requests, intake links, and medication administration actions are not implemented by this spec.

## Scenarios

### Scenario 1: Staff Opens Health Tab For Student With No Profile

**Given** an authenticated staff user has campus access and `student_health.read`
**And** the selected student belongs to the current campus
**And** no health profile exists yet
**When** the user requests the student's health profile
**Then** the backend returns `200`
**And** the response includes empty arrays for allergies, conditions, and restrictions
**And** `emergencyNotes` is `null`.

### Scenario 2: Nurse Updates Student Health Snapshot

**Given** an authenticated user has `student_health.update`
**When** the user updates allergies, conditions, restrictions, and emergency notes
**Then** the backend validates the structured payload
**And** saves the profile under the selected campus/student
**And** returns the updated profile
**And** records an audit event.

### Scenario 3: Teacher With Permission Creates A Health Event

**Given** an authenticated teacher has `student_health.create`
**And** the selected student belongs to the current campus
**When** the teacher creates a health event for eye redness observed in class
**Then** the backend creates a `StudentHealthEvent` with status `OPEN`
**And** records the teacher as the actor.

### Scenario 4: User Without Health Permission Tries To Read Health Data

**Given** an authenticated user can access the campus but lacks `student_health.read`
**When** the user requests health profile, checkups, instructions, or events
**Then** the backend returns `403`
**And** no health values are disclosed.

### Scenario 5: Staff Records A Checkup

**Given** an authenticated user has `student_health.create`
**When** the user creates a checkup with `heightCm` and `weightKg`
**Then** the backend stores the metric measurements
**And** does not calculate BMI or percentile
**And** returns the created checkup.

### Scenario 6: Staff Corrects A Checkup

**Given** an authenticated user has `student_health.update`
**When** the user updates a checkup measurement
**Then** the backend persists the corrected values
**And** audits the before/after values
**And** no delete endpoint is used.

### Scenario 7: Teacher Views Active Instructions For A Student

**Given** an authenticated teacher has `student_health.read`
**And** the student has an active medication instruction for the requested date
**When** the teacher requests active student instructions
**Then** the backend returns only instructions with derived status `ACTIVE`
**And** no administration action is created.

### Scenario 8: Teacher Views Active Instructions For A Class

**Given** an authenticated teacher has `student_health.read`
**And** the selected class belongs to the current campus
**When** the teacher requests active class instructions for a date
**Then** the backend returns active instructions grouped by student
**And** excludes students outside the selected class or campus.

### Scenario 9: Cross-Campus Student Access Is Rejected

**Given** a student belongs to Campus A
**And** the request selected campus is Campus B
**When** any health endpoint is called for that student
**Then** the backend returns not found or forbidden according to existing campus-scoping conventions
**And** no health data is disclosed.

### Scenario 10: Archived Student Is Readable But Not Mutable

**Given** an archived student belongs to the selected campus
**And** the user has `student_health.read`
**When** the user requests health data
**Then** the backend may return the read model
**When** the user tries to create or update health data
**Then** the backend rejects the write.

## Technical Notes

- Implement this as a new health vertical slice following the repository's Clean Architecture conventions: domain entities, application ports/use cases, Prisma repositories/mappers, HTTP DTOs/controllers, and module wiring.
- Do not add health fields to the existing Student update DTO.
- Do not make `PATCH /students/:id` accept medical fields.
- Prefer typed DTO validation at the boundary even if snapshot arrays are stored as JSON columns internally.
- Use existing standard response, pagination, filtering, campus guard, permissions guard, and audit patterns.
- Define health controllers so static routes like `/health-instructions/active` are registered before parameter routes like `/health-instructions/:instructionId`.
- Add unit tests for use-case validation and permission-sensitive controller metadata.
- Add repository tests or integration-style tests where the existing test pattern supports campus scoping and Prisma constraints.
- Seed only permission catalog entries in this spec. Default assignment of those permissions to Teacher, Nurse, or Admin roles can be handled by project seed policy or a separate role-seeding decision.

## Out Of Scope

- Parent medical instruction/request create/list/review workflow.
- Parent-visible health checkup measurements.
- Enrollment health intake links or public token forms.
- Medical documents or attachments.
- Medication administration logs/actions such as given, skipped, missed, or unable to administer.
- BMI, BMI percentile, growth percentile, or clinical interpretation.
- Cross-campus health profile continuity or transfer-resolution workflows.
- Deleting checkups, instructions, or health events.

## Task Links

Generated implementation tasks should be linked here after `/kn-plan --from @doc/specs/2026-07-01/student-profile-health-tab-backend` runs.

## Open Questions

- Should default seed data assign `student_health.*` permissions to existing Teacher, Nurse, Admin, or campus owner roles, or should projects assign those manually through RBAC admin screens?
- Should class active-instruction visibility later enforce teacher-class assignment in addition to campus permission, if/when that relationship is available as an authorization primitive?
- Should health history events later be generated automatically from profile/checkup/instruction changes, or remain manually created records?
