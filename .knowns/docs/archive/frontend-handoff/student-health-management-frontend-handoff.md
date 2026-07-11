---
title: Student Health Tab Backend Handoff
description: Backend-to-frontend handoff for the Student Profile Health tab, summarizing implemented backend support, current API contracts, data fields, backend validations, frontend responsibilities, and follow-up gaps.
createdAt: '2026-06-30T09:42:07.493Z'
updatedAt: '2026-07-10T22:05:08.922Z'
tags:
  - frontend-handoff
  - backend-contract
  - health
  - student-health
  - student-profile
  - api
  - campus
  - archived
---

# Student Health Tab Backend Handoff

## Purpose

This handoff is for the frontend developer building the Student Profile Health tab. It summarizes what backend support exists now, what was only researched/proposed, and what the frontend can safely integrate without reading the backend code deeply.

Important correction from the earlier frontend-to-backend proposal: there is currently no dedicated Student Health Profile / Medical Instruction / Health Intake backend API in this repository. The backend research identified reusable adjacent systems, but a health-specific implementation has not been added.

Use this document as the practical contract for the current backend state.

## 1. Backend Summary

### What Was Researched Or Completed

Completed:

- Backend research for a planned Student Health Management feature.
- Verification that the existing backend has no health, medical, allergy, medication, nurse-note, prescription, or health-intake domain model.
- Verification that the current Student API can support the non-health student profile shell/header only.
- Verification that Guardian self-service APIs can support parent campus/student selection.
- Verification that Absence Request is the closest existing workflow pattern for a future parent-submitted medical-instruction flow.
- This backend-to-frontend handoff document.

Not completed:

- No `StudentHealthProfile` model/API was implemented.
- No `MedicalInstruction` model/API was implemented.
- No health history/timeline API was implemented.
- No enrollment health-intake link/token API was implemented.
- No health-specific RBAC permissions were added.
- No health attachments or medication administration logging were added.

### Existing Backend Systems/Modules Involved

Real integration points available today:

- `StudentController`: existing student profile CRUD and guardian relationship endpoints.
- `GuardianController`: parent/current guardian campus and student discovery endpoints.
- `AbsenceRequestController`: reusable reference pattern for parent-submitted requests and staff review; not a medical API.
- `CampusGuard`, `ClerkAuthGuard`, `PermissionsGuard`: auth/campus/RBAC patterns.
- `StandardResponseInterceptor`: successful responses are wrapped in the project standard envelope.
- Prisma `Student`, `Guardian`, `GuardianStudent`, and `AbsenceRequest` models.

Relevant code anchors:

- `src/infra/http/controllers/user-management/student.controller.ts`
- `src/infra/http/dtos/user-management/student/student.response.ts`
- `src/infra/http/controllers/user-management/guardian.controller.ts`
- `src/infra/http/dtos/user-management/guardian/guardian-child.response.ts`
- `src/infra/http/controllers/absence-request.controller.ts`
- `src/infra/http/dtos/absence-request/`
- `prisma/schema.prisma`

### Important Decisions Made

- Current Health tab integration must not assume health fields exist on `StudentResponse`.
- Do not send health fields such as `allergies`, `medicalConditions`, `medications`, `emergencyNotes`, or `restrictions` to `PATCH /api/students/:id`; the global validation pipe rejects unknown fields.
- Existing student endpoints are campus-scoped general profile endpoints, not medical-record endpoints.
- Parent identity for self-service flows should be derived from the authenticated user, following the existing guardian and absence request pattern. The frontend should not send trusted `guardianId`/`userId` for parent actions.
- Absence Request is useful as an implementation reference for a future Medical Instruction backend, but it should not be reused or relabeled in the frontend as medication/health support.

## 2. Final API Contract

### Shared API Rules

Base path:

- All app routes are under `/api`.

Authentication:

- Protected routes require Clerk bearer auth: `Authorization: Bearer <token>`.
- Unauthenticated requests return `401`.

Campus context:

- Most campus-scoped routes require `x-campus-id: <campusUuid>`.
- Missing campus context returns `400`.
- Invalid campus UUID returns `400`.
- Campus not found returns `404`.
- No access to the campus returns `403`.

Successful response envelope:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "timestamp": "2026-07-01T00:00:00.000Z"
}
```

Paginated successful response envelope:

```json
{
  "success": true,
  "message": "Students retrieved successfully",
  "data": [],
  "pagination": {
    "count": 25,
    "limit": 10,
    "offset": 0,
    "totalPages": 3,
    "currentPage": 1,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": "2026-07-01T00:00:00.000Z"
}
```

Error responses use NestJS exception payloads. Validation errors may return `message` as an array.

```json
{
  "message": "Authentication required",
  "error": "Unauthorized",
  "statusCode": 401
}
```

### Implemented Endpoints The Health Tab Can Use Today

#### `GET /api/students/:id`

Purpose:

- Load the student profile shell/header for the Health tab.
- Does not return health, allergy, medication, or medical-history data.

Auth/permissions:

- Requires Clerk auth.
- Requires `x-campus-id`.
- Requires access to the campus through `CampusGuard`.
- No explicit `PermissionsGuard`/`student.read` permission is currently applied in `StudentController`.

Request:

```http
GET /api/students/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
x-campus-id: 11111111-1111-4111-8111-111111111111
```

Response:

```json
{
  "success": true,
  "message": "Student retrieved successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "campusId": "11111111-1111-4111-8111-111111111111",
    "studentCode": "2026-000001",
    "fullName": "Nguyen Van A",
    "email": null,
    "phoneNumber": null,
    "address": "123 ABC Street, District 1, HCMC",
    "dateOfBirth": "2018-05-15T00:00:00.000Z",
    "nickname": "Be A",
    "gender": "MALE",
    "phase": "ACTIVE",
    "isArchived": false,
    "currentClass": {
      "id": "223e4567-e89b-12d3-a456-426614174000",
      "name": "Sunflower"
    },
    "guardians": [
      {
        "id": "323e4567-e89b-12d3-a456-426614174000",
        "fullName": "Nguyen Thi B",
        "relationship": "Mother",
        "email": "parent@example.com",
        "phoneNumber": "+84912345678"
      }
    ],
    "createdAt": "2026-06-01T10:00:00.000Z",
    "updatedAt": "2026-06-20T10:00:00.000Z"
  },
  "timestamp": "2026-07-01T00:00:00.000Z"
}
```

Errors:

- `400`: invalid `:id` UUID, missing/invalid campus header.
- `401`: unauthenticated.
- `403`: authenticated user has no access to selected campus.
- `404`: student does not exist or does not belong to selected campus.

#### `GET /api/students`

Purpose:

- Load campus-scoped student lists for staff/admin selection or navigation.
- Can support finding a student before opening the profile/Health tab.

Auth/permissions:

- Requires Clerk auth.
- Requires `x-campus-id` and campus access.
- No explicit `PermissionsGuard` is currently applied in `StudentController`.

Query parameters:

- `limit`: number, default project behavior, capped at 50.
- `offset`: number, 0-based.
- `sort`: comma-separated fields; prefix with `-` for desc.
- `filter`: JSON string using project filter operators.

Known student filter fields from docs/controller description:

- `studentCode`
- `fullName`
- `email`
- `phoneNumber`
- `gender`
- `nickname`
- `isArchived`
- `dateOfBirth`
- `phase`

Known student sort fields from pagination docs:

- `createdAt`
- `updatedAt`
- `nickname`
- `studentCode`
- `fullName`
- `dateOfBirth`

Request:

```http
GET /api/students?limit=10&offset=0&sort=fullName&filter={"phase":{"in":["ACTIVE","WAITING"]}}
Authorization: Bearer <token>
x-campus-id: 11111111-1111-4111-8111-111111111111
```

Response: paginated envelope with `StudentResponse[]` as `data`.

Errors:

- `400`: invalid filter JSON, unsupported filter/sort field, invalid limit/offset, missing/invalid campus header.
- `401`: unauthenticated.
- `403`: no campus access.

#### `PATCH /api/students/:id`

Purpose:

- Update general student profile fields only.
- Not valid for health data.

Auth/permissions:

- Requires Clerk auth.
- Requires `x-campus-id` and campus access.
- No explicit `PermissionsGuard` is currently applied in `StudentController`.

Request payload:

All fields are optional:

```json
{
  "fullName": "Nguyen Van A",
  "nickname": "Be A",
  "dateOfBirth": "2018-05-15T00:00:00.000Z",
  "gender": "MALE",
  "phoneNumber": "+84912345678",
  "email": "student@example.com",
  "address": "123 ABC Street, District 1, HCMC"
}
```

Response: standard envelope with `StudentResponse`.

Important validation behavior:

- Unknown fields are rejected. Sending Health tab fields like `allergies` or `medications` will produce `400`.
- `email` must be valid email format and unique within the campus when changed.
- `phoneNumber` must be E.164 and unique within the campus when changed.
- `gender` must be `MALE`, `FEMALE`, or `OTHER`.
- `fullName` must be 2-100 chars when provided.
- `nickname` max 50 chars.
- `address` max 500 chars.
- `dateOfBirth` must pass the backend DOB validator.

Example bad Health tab request:

```http
PATCH /api/students/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer <token>
x-campus-id: 11111111-1111-4111-8111-111111111111
Content-Type: application/json
```

```json
{
  "allergies": ["Peanuts"]
}
```

Expected result:

```json
{
  "message": ["property allergies should not exist"],
  "error": "Bad Request",
  "statusCode": 400
}
```

#### `GET /api/students/:id/guardians`

Purpose:

- Load guardians linked to a student for display context.
- Useful on profile pages, but not health-specific.

Auth/permissions:

- Requires Clerk auth.
- Requires `x-campus-id` and campus access.

Response data item shape:

```json
{
  "guardianId": "323e4567-e89b-12d3-a456-426614174000",
  "fullName": "Nguyen Thi B",
  "email": "parent@example.com",
  "phoneNumber": "+84912345678",
  "relationship": "MOTHER",
  "relationshipName": "Mother"
}
```

#### `GET /api/guardians/me/campuses`

Purpose:

- Parent self-service: discover campuses where the authenticated user has an active guardian profile.
- Useful before showing a parent-facing student selector for a future medical instruction flow.

Auth/permissions:

- Requires Clerk auth.
- Uses current authenticated user.
- Does not require a campus header.

Request:

```http
GET /api/guardians/me/campuses
Authorization: Bearer <parent-token>
```

Response:

```json
{
  "success": true,
  "message": "Guardian campuses retrieved successfully",
  "data": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "name": "Main Campus",
      "address": "123 Main Street",
      "phoneNumber": "+84901234567"
    }
  ],
  "timestamp": "2026-07-01T00:00:00.000Z"
}
```

#### `GET /api/guardians/me/students`

Purpose:

- Parent self-service: list active students linked to the authenticated guardian in the selected campus.
- This is the correct source for a parent-facing student dropdown.

Auth/permissions:

- Requires Clerk auth.
- Requires `x-campus-id`.
- Campus must exist and be active.
- Uses guardian relationship; does not trust a frontend-supplied `guardianId`.

Request:

```http
GET /api/guardians/me/students
Authorization: Bearer <parent-token>
x-campus-id: 11111111-1111-4111-8111-111111111111
```

Response:

```json
{
  "success": true,
  "message": "Guardian students retrieved successfully",
  "data": [
    {
      "student": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "fullName": "Nguyen Van A",
        "studentCode": "2026-000001"
      },
      "guardianRelationship": {
        "id": "423e4567-e89b-12d3-a456-426614174000",
        "name": "Mother"
      }
    }
  ],
  "timestamp": "2026-07-01T00:00:00.000Z"
}
```

Errors:

- `401`: unauthenticated.
- `403`: current user is not an active guardian in the selected campus.
- `404`: campus not found.

### Existing Absence Request API: Pattern Only, Not Health Support

The existing Absence Request endpoints are implemented and production-like, but they represent absence requests only. They should not be used as medication/health APIs.

They are relevant because a future Medical Instruction implementation should likely mirror this shape:

- Parent create route derives guardian from auth.
- Parent history route lists only the current guardian's requests.
- Staff list/detail/review routes are campus-scoped and permission-gated.
- Staff review supports `APPROVED` / `DENIED` from `PENDING`.

Implemented endpoints:

- `POST /api/absence-requests`
- `GET /api/absence-requests/mine`
- `GET /api/absence-requests`
- `GET /api/absence-requests/:id`
- `PATCH /api/absence-requests/:id/review`

Absence permissions:

- Staff list: `absence_request.list`
- Staff detail: `absence_request.read`
- Staff review: `absence_request.update`

Parent routes do not require those RBAC permissions; they derive guardian access from the authenticated user and selected campus.

### Health-Specific Endpoints Not Implemented

Do not integrate against these yet:

- `GET /api/students/:studentId/health-profile`
- `PATCH /api/students/:studentId/health-profile`
- `GET /api/students/:studentId/health-history`
- `POST /api/medical-instructions`
- `GET /api/medical-instructions/mine`
- `GET /api/medical-instructions`
- `GET /api/medical-instructions/:id`
- `PATCH /api/medical-instructions/:id/review`
- `GET /api/health-intake-links/:token`
- `POST /api/health-intake-links/:token/submission`
- `GET /api/medical-instructions/active`
- `POST /api/medical-instructions/:id/administration-events`

These names came from research/proposal only. They are not final backend contracts.

## 3. Data Model / Field Details

### `StudentResponse`

| Field | Type | Required | Nullable/Missing Notes | Frontend Notes |
| --- | --- | --- | --- | --- |
| `id` | string UUID | Yes | Never null | Stable student ID. |
| `campusId` | string UUID | Yes | Never null | Current campus scope. |
| `studentCode` | string | Yes | Never null | Auto-generated per campus/year. |
| `fullName` | string | Yes | Never null | Primary display name. |
| `email` | string | No | `null` allowed | Optional for older students. |
| `phoneNumber` | string | No | `null` allowed | E.164 when present. |
| `address` | string | No | `null` allowed | General profile address. |
| `dateOfBirth` | ISO datetime string | No | `null` allowed | Stored as date; API example serializes as UTC midnight. |
| `nickname` | string | No | `null` allowed | Display nickname. |
| `gender` | enum string | No | `null` allowed | `MALE`, `FEMALE`, `OTHER`. |
| `phase` | enum string | No | Can be `null` | Derived from enrollment view on GET endpoints. |
| `isArchived` | boolean | Yes | Never null | Soft archive flag. |
| `currentClass` | object | No | Can be `null` | `{ id, name }` for currently open enrollment. |
| `guardians` | array | No | May be missing or empty | Present only when repository/use case loads guardian relation. |
| `createdAt` | ISO datetime string | Yes | Never null | Creation timestamp. |
| `updatedAt` | ISO datetime string | Yes | Never null | Update timestamp. |

### `currentClass`

```json
{
  "id": "223e4567-e89b-12d3-a456-426614174000",
  "name": "Sunflower"
}
```

May be `null` when the student has no open enrollment. It may also be `null` immediately after some write endpoints because write paths read from the base student table, while GET endpoints project from the `student_with_phase` view.

### `GuardianInfo` On `StudentResponse.guardians`

| Field | Type | Required | Nullable Notes |
| --- | --- | --- | --- |
| `id` | string UUID | Yes | Never null |
| `fullName` | string | Yes | Never null |
| `relationship` | string | Yes | Existing relationship label/code |
| `email` | string | No | `null` allowed |
| `phoneNumber` | string | No | `null` allowed |

### `GuardianCampusResponse`

| Field | Type | Required | Nullable Notes |
| --- | --- | --- | --- |
| `id` | string UUID | Yes | Never null |
| `name` | string | Yes | Never null |
| `address` | string | No | `null` allowed |
| `phoneNumber` | string | No | `null` allowed |

### `GuardianChildResponse`

```json
{
  "student": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "fullName": "Nguyen Van A",
    "studentCode": "2026-000001"
  },
  "guardianRelationship": {
    "id": "423e4567-e89b-12d3-a456-426614174000",
    "name": "Mother"
  }
}
```

### Enums The Frontend Should Know Today

Student gender:

- `MALE`
- `FEMALE`
- `OTHER`

Student phase:

- `ACTIVE`
- `WAITING`
- `DEFERRED`
- `GRADUATED`
- `WITHDRAWN`

Absence request type, for the existing absence module only:

- `FULL_DAY`
- `PARTIAL_DAY`

Absence request status, for the existing absence module only:

- `PENDING`
- `APPROVED`
- `DENIED`

No health-specific enum exists today. There is no canonical allergy severity, medical condition type, medication schedule type, medical-instruction status, intake status, or health-history event type in the backend.

### Defaults

Student:

- `studentCode` is generated server-side.
- `isArchived` defaults to `false`.
- `currentClass` defaults to `null` when there is no open enrollment.
- `phase` is derived from enrollment state and may be `null` in write responses.
- `createUserAccount` defaults to `false` on `POST /api/students`.

Absence request, for reference only:

- `status` defaults to `PENDING`.
- `endDate` defaults to `startDate` when omitted.
- Full-day absence forces `startTime`/`endTime` to null.

### Fields Not Available To The Health Tab

The backend does not currently expose or persist:

- `allergies`
- `medicalConditions`
- `currentMedications`
- `medications`
- `restrictions`
- `emergencyNotes`
- `physicianInfo`
- `insuranceInfo`
- `medicalAttachments`
- `healthUpdatedBy`
- `healthUpdatedAt`
- `healthHistory`
- `medicalInstructionStatus`
- `dosage`
- `medicationSchedule`
- `administrationEvents`

If the UI needs these fields, backend work is still required.

## 4. Business Logic Handled By Backend

### Existing Student/Profile Backend Logic

Handled now:

- Clerk authentication for student routes.
- Campus context extraction from `x-campus-id`, params, or query.
- Campus UUID validation.
- Campus existence and active-campus checks.
- User campus access checks, with global admin bypass.
- `GET /students/:id` returns 404 when the student is not in the selected campus.
- Student create/update DTO validation:
  - `fullName`: string, required on create, 2-100 chars.
  - `nickname`: optional string, max 50 chars.
  - `dateOfBirth`: transformed to UTC date and validated by DOB validator.
  - `gender`: `MALE`, `FEMALE`, `OTHER`.
  - `phoneNumber`: optional E.164.
  - `email`: optional valid email.
  - `address`: optional string, max 500 chars.
  - unknown fields rejected.
- Student email uniqueness within campus on create/update when email is present/changed.
- Student phone uniqueness within campus on create/update when phone is present/changed.
- Create/update emits audit records for student profile changes.
- Student archive/restore exists as soft lifecycle behavior.

Not handled for health:

- Allergy/condition/medication validation.
- Medical-field requiredness.
- Health history versioning.
- Health-specific privacy or field-level authorization.
- Health attachment validation.
- Medication schedule validation.

### Existing Parent/Guardian Backend Logic

Handled now:

- `GET /guardians/me/campuses` resolves campuses from the authenticated user.
- `GET /guardians/me/students` resolves active students linked to the authenticated guardian in the selected campus.
- Parent/current guardian workflows should not rely on client-supplied `guardianId`.

### Existing Absence Request Logic, For Future Medical Instruction Reference Only

Handled now for absence requests:

- Parent create derives the current guardian from the authenticated user and selected campus.
- Backend rejects a request if the selected student is not linked to the current guardian.
- Backend rejects absence dates in the past.
- Backend rejects overlapping active absence requests for the same student/date period.
- `FULL_DAY` vs `PARTIAL_DAY` date/time rules are validated.
- Review transitions only allow `PENDING` -> `APPROVED` or `PENDING` -> `DENIED`.
- Review stores reviewer metadata and timestamp.
- Staff list/detail/review routes are campus-scoped and RBAC-gated with absence permissions.

This logic is not available for medical instructions until a health/medical backend is implemented.

## 5. Business Logic Frontend Still Needs To Handle

### For The Current Health Tab UI

Until backend health APIs exist, frontend should:

- Treat the Health tab as not backed by API data.
- Use `GET /api/students/:id` only for the student header/profile context.
- Show an empty/not-configured state for health sections, or keep the Health tab behind a feature flag.
- Do not fake persistence by saving health fields into student profile fields.
- Do not submit health fields to `PATCH /api/students/:id`; unknown fields are rejected.
- Do not assume health history follows a student across campus transfers; there is no backend model for that yet.
- Do not assume parent medical instructions can be submitted; no endpoint exists.
- Do not assume health-specific permissions or status values exist.

### Client-Side Validation Still Useful

Frontend can validate for UX before calling existing student APIs:

- Require `fullName` on student create.
- Enforce reasonable max lengths matching DTOs.
- Validate email format.
- Validate E.164 phone format if the field is exposed.
- Use `MALE | FEMALE | OTHER` for gender.
- Never send empty strings for optional fields if the desired backend value is null; normalize intentionally based on existing frontend API client behavior.

For future health fields, frontend can design draft validation, but backend validation is not canonical yet because the API does not exist.

### Assumptions The Frontend Should Not Make Anymore

Do not assume:

- `StudentResponse` includes medical fields.
- Student profile PATCH can be extended client-side with arbitrary fields.
- Absence Request can stand in for medication instructions.
- Parent Request Center already supports `MEDICAL_INSTRUCTION` request type in backend.
- Health data is stored globally across campuses.
- Prior-campus staff/new-campus staff visibility for health history has been decided.
- Attachments for prescriptions/doctor notes are allowed.
- Public/tokenized enrollment health intake links exist.

### Edge Cases To Display Clearly

For current student/profile integration:

- Student not found or not in selected campus: show not found / access-safe empty state.
- No `currentClass`: show “No current class” or equivalent.
- `phase` is `null`: do not crash; show unknown/not available.
- `guardians` missing or empty: show no linked guardians.
- Parent has no linked campuses/students: show parent empty state.
- 400 validation error: show field-level errors where possible.
- 401: prompt re-login/session refresh.
- 403: show permission/access denied.
- 409 on student email/phone update: show duplicate email/phone conflict.

For the future Health tab:

- No health profile exists yet.
- Backend health feature unavailable.
- Sensitive field hidden because user lacks permission.
- Historical health records unavailable because backend policy does not permit cross-campus visibility.

## 6. Known Issues / Follow-Ups

### Not Finished

- Implement a student health profile domain model and API.
- Implement parent medical-instruction request create/history/detail/review flow.
- Implement student health history/timeline.
- Implement enrollment health-intake link/token lifecycle, if still required.
- Implement daily active medical instructions and medication administration logging, if in scope.
- Add health-specific RBAC permissions and seed them.
- Add health-specific audit events and retention/privacy decisions.
- Decide whether health records are student-global, campus-scoped, copied on transfer, or linked across campuses.

### Technical Debt / Risks

- The current `Student` model is campus-scoped. Cross-campus health continuity needs an explicit backend design.
- Medical data is more sensitive than ordinary student profile data. Field-level access, audit, and attachment controls need product/backend decisions.
- Existing file upload infrastructure exists, but upload validation has a known TODO; health attachments need stricter MIME/size/access policy before use.
- No public token-link pattern was found for enrollment intake. That is a new security surface.
- The existing frontend-to-backend proposal contains suggested health endpoint names. Those should not be treated as implemented or final.

### Suggested Backend Follow-Up Contract For Health Tab

To unblock the real Health tab, backend should produce an approved contract for at least this smallest slice:

- `GET /api/students/:studentId/health-profile`
- `PATCH /api/students/:studentId/health-profile`
- Health profile response fields: allergies, conditions, medications, restrictions, emergency notes, updated metadata.
- Permission model for staff/admin read/write and parent read/write, if any.
- Error meanings for no profile, no access, validation failure, and stale update.
- Audit behavior for every health profile edit.

Until that exists, the frontend can only integrate the Student Profile shell and display the Health tab as unavailable/empty.
