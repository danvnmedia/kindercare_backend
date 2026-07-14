---
title: Student Attendance API Follow-up
description: Implementation-ready backend API follow-up for Student Attendance after frontend integration review, covering timeline actor display and scalable attendance class selection.
createdAt: '2026-07-12T15:09:08.044Z'
updatedAt: '2026-07-14T00:02:37.564Z'
tags:
  - api
  - backend
  - student-attendance
  - attendance
  - roll-call
  - frontend-handoff
  - follow-up
  - api-needed
---

# Student Attendance API Follow-up

## Status

- Source: frontend integration review completed on 2026-07-12.
- Existing roll-call APIs are implemented and verified:
  - `GET /attendance/class/:classId/roll-call?date=YYYY-MM-DD`
  - `POST /attendance/class/:classId/roll-call`
- Existing targeted backend verification: 3 test suites and 10 tests passed.
- This document defines additive follow-up work; it does not replace @doc/specs/2026-07-06/student-attendance-backend-v1.
- Originating handoff: @doc/archive/frontend-handoff/student-attendance-backend-handoff.

## 1. Problem Summary

The frontend integration found two remaining backend-facing gaps:

1. Timeline entries expose only `actorId`, so the frontend cannot render the human-readable actor required by the attendance activity panel.
2. The attendance page currently obtains class choices from the general paginated `GET /classes` API and loads only the first 50 rows. Campuses with more than 50 classes can leave valid classes unreachable from the roll-call workflow.

The existing roll-call load/save contracts, campus header behavior, permissions, date-only format, approved absence fields, row result values, and reason codes otherwise match the frontend implementation.

## 2. Priority A — Human-readable Timeline Actors

### Recommended Contract Change

Extend each `timeline[]` item returned by:

`GET /attendance/class/:classId/roll-call?date=YYYY-MM-DD`

with a nullable actor summary:

```json
{
  "id": "change-log-uuid",
  "changeType": "STATUS_CHANGED",
  "previousValue": {},
  "newValue": {},
  "actorId": "user-uuid",
  "actor": {
    "id": "user-uuid",
    "displayName": "Nguyen Van A",
    "email": "teacher@example.com"
  },
  "note": "Corrected after parent confirmation",
  "createdAt": "2026-07-12T08:00:00.000Z"
}
```

### Field Rules

| Field | Type | Required | Nullable | Rule |
|---|---|---:|---:|---|
| `actorId` | UUID/string | yes | no | Preserve for internal correlation and backward compatibility. |
| `actor` | object | yes | yes | Null when the referenced user no longer exists or is not resolvable. |
| `actor.id` | UUID/string | yes when actor exists | no | Must match `actorId`. |
| `actor.displayName` | string | yes when actor exists | no | Human-readable label; never require the frontend to derive it from IDs. |
| `actor.email` | string | no | yes | Optional secondary context; omit if disclosure is not appropriate. |

### Backend Implementation Guidance

- Resolve actors in bulk for all timeline entries returned by a sheet; do not perform one user lookup per timeline row.
- Deduplicate actor IDs before repository lookup.
- Preserve timeline entries when actor lookup fails; return `actor: null` rather than dropping activity history.
- Do not expose secrets, auth-provider metadata, role internals, or unrelated user profile fields.
- Prefer a small reusable `AttendanceTimelineActor` response DTO.
- If the response serializer omits undefined fields, explicitly return `actor: null` for a stable contract.

### Alternative Contract

If changing the roll-call response is undesirable, provide a campus-scoped batch resolver such as:

`POST /users/display-summaries:resolve`

with a bounded list of actor IDs. The embedded actor summary is preferred because it avoids a second request, reduces client orchestration, and keeps attendance history self-contained.

### Acceptance Criteria

- Timeline entries include a human-readable actor when the actor can be resolved.
- Raw `actorId` remains available for internal correlation but is not the only display data.
- Missing/deleted actors return `actor: null` without failing the roll-call request.
- Actor resolution is bulk-loaded and does not introduce N+1 queries.
- Campus/auth disclosure rules are preserved.
- DTO, use-case, and controller/integration tests cover resolved and unresolved actors.

## 3. Priority B — Scalable Attendance Class Options

### Recommended Endpoint

`GET /attendance/class-options`

This endpoint provides a lightweight, campus-scoped class selector contract for roll-call.

### Authentication And Authorization

- Authenticated user required.
- `x-campus-id` required.
- Campus access required.
- Require either `attendance.read` or `attendance.list`.
- Return only classes the user is allowed to view in the selected campus.
- If product policy limits teachers to assigned classes, apply that rule here and document the super-admin behavior explicitly.

### Query Parameters

| Field | Type | Required | Default | Notes |
|---|---|---:|---|---|
| `search` | string | no | empty | Case-insensitive match on class name/code. |
| `limit` | integer | no | 25 | Maximum 100. |
| `offset` | integer | no | 0 | Standard offset pagination. |
| `sort` | string | no | `name` | Allowlisted fields only. |
| `date` | `YYYY-MM-DD` | no | today | Optional future-proofing to exclude classes inactive on the attendance date. |

### Response

Use the repository standard paginated envelope:

```json
{
  "success": true,
  "message": "Attendance class options retrieved successfully",
  "data": [
    {
      "id": "class-uuid",
      "name": "Sunflower A",
      "code": "SUN-A",
      "studentCount": 24,
      "canSaveAttendance": true
    }
  ],
  "meta": {
    "total": 138,
    "limit": 25,
    "offset": 0,
    "hasMore": true
  },
  "timestamp": "2026-07-12T08:00:00.000Z"
}
```

### Minimum Option Shape

| Field | Type | Required | Notes |
|---|---|---:|---|
| `id` | UUID/string | yes | Used as roll-call `classId`. |
| `name` | string | yes | Primary selector label. |
| `code` | string/null | no | Secondary disambiguation label. |
| `studentCount` | number | no | Active roster count for the effective date if inexpensive. |
| `canSaveAttendance` | boolean | no | Indicates current HOMEROOM/ASSISTANT eligibility; backend POST authorization remains authoritative. |

### Reuse Option

The backend may instead enhance the existing `GET /classes` contract if it already supports campus scoping, search, pagination, and the required attendance permissions. In that case:

- frontend must use pagination/infinite loading rather than a fixed first page;
- permission behavior must be compatible with attendance-only staff;
- document the exact query and response fields in this doc;
- avoid returning heavyweight class detail data solely for a selector.

### Acceptance Criteria

- A campus with more than 50 classes can reach every allowed class through pagination/search.
- Results remain scoped by `x-campus-id`.
- Permission semantics match the roll-call read endpoint.
- Search, limit, offset, and sort are validated.
- Cross-campus classes never appear.
- Controller and use-case tests cover pagination, search, campus isolation, and permission denial.

## 4. Existing Roll-call Contract — No Change Required

The frontend review confirmed these existing behaviors:

- strict date-only `YYYY-MM-DD`;
- standard success envelope;
- campus scoping through `x-campus-id`;
- read permission OR logic: `attendance.read` or `attendance.list`;
- save permission OR logic: `attendance.create` or `attendance.update`;
- row-level HOMEROOM/ASSISTANT authorization;
- partial sheet saves;
- approved absence matching and override-note validation;
- save results `SAVED`, `UNCHANGED`, `SKIPPED`, `VALIDATION_ERROR`, and `PERMISSION_DENIED`;
- documented row reason codes;
- refresh-after-save because V1 has no stale-write version contract.

## 5. Out Of Scope

- Clearing an existing attendance record through `NOT_IDENTIFIED`.
- Creating `LATE` or `LEFT_EARLY` through roll-call V1.
- Changing the existing roll-call save payload.
- Attendance reports or student history redesign.
- Frontend fixes for draft preservation, bulk-action overwrite, and unsaved-change confirmation.

## 6. Verification Plan

1. Add or update DTO serialization tests.
2. Add use-case tests for bulk actor resolution and missing actors.
3. Add controller metadata/permission tests for class options.
4. Add repository tests for campus filtering, search, and pagination.
5. Run targeted attendance tests and backend build.
6. Provide a backend-to-frontend handoff with final response examples after implementation.
