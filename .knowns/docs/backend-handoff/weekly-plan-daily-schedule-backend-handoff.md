---
title: Weekly Plan Daily Schedule Backend Handoff
description: Backend-to-frontend integration handoff for the implemented Weekly Plan Daily Schedule APIs, data model, validation, permissions, and known follow-ups.
createdAt: '2026-06-18T22:33:11.290Z'
updatedAt: '2026-06-25T16:34:40.896Z'
tags:
  - backend-handoff
  - frontend
  - weekly-plan
  - schedule
  - api
---

# Weekly Plan Daily Schedule Backend Handoff

## Source References

This handoff is the canonical implemented backend contract for class-scoped Weekly Plan daily schedules.

- Backend research: @doc/research/weekly-plan-daily-schedule-backend-research
- Original frontend handoff: @doc/frontend-handoff/weekly-plan-daily-schedule-frontend-handoff
- Shared pagination/filtering contract: @doc/guides/pagination-and-filtering

## 1. Backend Summary

### What Was Completed

Backend support for Weekly Plan Daily Schedule is implemented as a new vertical slice named `weekly-plan` with HTTP routes under `/weekly-plans`.

Completed work includes:

- Prisma persistence for `WeeklyPlan`, `WeeklyPlanBlock`, and `WeeklyPlanActivity`.
- Active-only uniqueness for `(campusId, classId, weekStartDate)` so archived plans do not block replacement active plans.
- Domain validation for Monday week anchors, time parsing, block ordering, overlap detection, theme length, and activity text rules.
- Repository, mapper, and Unit of Work transaction operations for weekly plan create/update/archive/restore.
- HTTP module, controller, DTOs, and use cases for create, list, read, active lookup, update, whole-week copy, archive, and restore.
- RBAC permission catalog and route guards for `weekly_plan.*` permissions.
- Transaction-bound audit events for create, copy, update, archive, and restore.
- Generated audit action export updated to include the 5 weekly-plan audit actions.

### Existing Backend Systems Involved

- `ClerkAuthGuard`: all Weekly Plan routes require authenticated requests.
- `CampusGuard` via `@RequireCampusAccess()`: every route is scoped to the active campus context.
- `PermissionsGuard`: every route requires a specific `weekly_plan.*` permission.
- Standard response and query layer: list uses the existing `limit`, `offset`, `sort`, and JSON `filter` behavior.
- Class repository: create, copy, update, and active lookup validate class existence and campus ownership.
- Unit of Work: mutating operations and audit records commit or roll back together.
- Audit event recorder: Weekly Plan audit target type is `weekly_plan`.
- RBAC seed permissions: `weekly_plan.list`, `weekly_plan.read`, `weekly_plan.create`, `weekly_plan.update`, `weekly_plan.delete`.

### Important Decisions Made

- Weekly Plans are class-specific and exact. There is no Meal Menu-style fallback.
- `campusId` is never accepted from the request body. It comes from campus context, normally the `x-campus-id` header.
- `weekStartDate` is a Monday date anchor. Backend accepts date strings or ISO datetimes and normalizes to date-only UTC midnight.
- API block times use `HH:mm` strings. Backend stores minutes internally.
- Create and whole-week copy support multiple classes in one request.
- Batch create/copy uses partial success. Request-level validation errors abort the request; per-class failures return `skipped[]` entries.
- Day-copy remains frontend-local. The frontend should copy one day's blocks in local state and submit the full schedule through `PATCH /weekly-plans/:id`.
- Updates use full schedule replacement when `blocks` is supplied. There are no granular block/activity endpoints.
- Archived plans are hidden from the default list and do not block creating a replacement active plan.
- `GET /weekly-plans/active` returns `plan: null` for a valid class/week with no active plan.
- Cross-campus and missing classes collapse to not-found behavior. In batch skipped results, both are reported as `CLASS_NOT_FOUND`.

## 2. Final API Contract

### Common Requirements

All routes require:

```http
Authorization: Bearer <JWT>
x-campus-id: <campus UUID>
```

The campus header is system scope, not a user-controlled filter. The backend verifies the campus exists, is active, and the user has access.

### Response Envelope

Successful responses use the standard backend envelope:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "timestamp": "2026-06-18T13:00:00.000Z"
}
```

Paginated responses also include:

```json
{
  "pagination": {
    "count": 25,
    "limit": 10,
    "offset": 0,
    "totalPages": 3,
    "currentPage": 1,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Permission Matrix

| Method | Path | Permission |
| --- | --- | --- |
| `GET` | `/weekly-plans` | `weekly_plan.list` |
| `GET` | `/weekly-plans/active` | `weekly_plan.read` |
| `GET` | `/weekly-plans/:id` | `weekly_plan.read` |
| `POST` | `/weekly-plans` | `weekly_plan.create` |
| `PATCH` | `/weekly-plans/:id` | `weekly_plan.update` |
| `POST` | `/weekly-plans/:id/copy` | `weekly_plan.create` |
| `DELETE` | `/weekly-plans/:id` | `weekly_plan.delete` |
| `PATCH` | `/weekly-plans/:id/restore` | `weekly_plan.update` |

### Weekly Plan Object

This is the common response shape inside `data`, `created[]`, `copied[]`, or `plan`:

```json
{
  "id": "11111111-1111-4111-a111-111111111111",
  "campusId": "22222222-2222-4222-a222-222222222222",
  "classId": "33333333-3333-4333-a333-333333333333",
  "classroom": {
    "id": "33333333-3333-4333-a333-333333333333",
    "name": "K1 Room A",
    "gradeLevelId": "44444444-4444-4444-8444-444444444444",
    "gradeLevelName": "Kindergarten",
    "schoolYearId": "55555555-5555-4555-8555-555555555555",
    "schoolYearName": "2026-2027"
  },
  "weekStartDate": "2026-06-01T00:00:00.000Z",
  "theme": "Community Helpers",
  "blocks": [
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "10:00",
      "activities": [
        { "order": 0, "text": "Morning Meeting" },
        { "order": 1, "text": "Centers" }
      ]
    }
  ],
  "isArchived": false,
  "createdAt": "2026-06-18T13:00:00.000Z",
  "updatedAt": "2026-06-18T13:00:00.000Z"
}
```

### `GET /weekly-plans`

Lists weekly plans for the active campus.

Default behavior:

- Archived plans are excluded unless the `filter` includes `isArchived`.
- Default sort is `weekStartDate` descending.
- Uses standard `limit`, `offset`, `sort`, and JSON `filter` query parameters.

Allowed sort fields:

- `weekStartDate`
- `createdAt`
- `updatedAt`

Allowed filter fields:

- `classId`
- `weekStartDate`
- `isArchived`
- `createdAt`
- `updatedAt`

Example request:

```http
GET /weekly-plans?limit=20&offset=0&sort=-weekStartDate&filter={"classId":"33333333-3333-4333-a333-333333333333"}
Authorization: Bearer <JWT>
x-campus-id: 22222222-2222-4222-a222-222222222222
```

In real URLs, `filter` should be `encodeURIComponent(JSON.stringify(filter))`.

Example response:

```json
{
  "success": true,
  "message": "Weekly plans retrieved successfully",
  "data": [
    {
      "id": "11111111-1111-4111-a111-111111111111",
      "campusId": "22222222-2222-4222-a222-222222222222",
      "classId": "33333333-3333-4333-a333-333333333333",
      "classroom": {
        "id": "33333333-3333-4333-a333-333333333333",
        "name": "K1 Room A",
        "gradeLevelId": null,
        "gradeLevelName": null,
        "schoolYearId": null,
        "schoolYearName": null
      },
      "weekStartDate": "2026-06-01T00:00:00.000Z",
      "theme": null,
      "blocks": [],
      "isArchived": false,
      "createdAt": "2026-06-18T13:00:00.000Z",
      "updatedAt": "2026-06-18T13:00:00.000Z"
    }
  ],
  "pagination": {
    "count": 1,
    "limit": 20,
    "offset": 0,
    "totalPages": 1,
    "currentPage": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "timestamp": "2026-06-18T13:00:00.000Z"
}
```

To show archived plans only:

```http
GET /weekly-plans?filter={"isArchived":true}
```

### `GET /weekly-plans/active`

Looks up the exact active plan for one class and one Monday week.

Query parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `classId` | Yes | UUID. Must exist in active campus. |
| `weekStartDate` | Yes | Monday date anchor. Prefer `YYYY-MM-DD`. |

Example request:

```http
GET /weekly-plans/active?classId=33333333-3333-4333-a333-333333333333&weekStartDate=2026-06-01
Authorization: Bearer <JWT>
x-campus-id: 22222222-2222-4222-a222-222222222222
```

Example response with a plan:

```json
{
  "success": true,
  "message": "Active weekly plan retrieved successfully",
  "data": {
    "plan": {
      "id": "11111111-1111-4111-a111-111111111111",
      "campusId": "22222222-2222-4222-a222-222222222222",
      "classId": "33333333-3333-4333-a333-333333333333",
      "classroom": null,
      "weekStartDate": "2026-06-01T00:00:00.000Z",
      "theme": "Community Helpers",
      "blocks": [],
      "isArchived": false,
      "createdAt": "2026-06-18T13:00:00.000Z",
      "updatedAt": "2026-06-18T13:00:00.000Z"
    }
  },
  "timestamp": "2026-06-18T13:00:00.000Z"
}
```

Example valid empty response:

```json
{
  "success": true,
  "message": "Active weekly plan retrieved successfully",
  "data": {
    "plan": null
  },
  "timestamp": "2026-06-18T13:00:00.000Z"
}
```

Use this endpoint for the editor initial load. Do not infer empty state from list results.

### `GET /weekly-plans/:id`

Gets one campus-scoped weekly plan by ID.

Notes:

- Authorized read callers can retrieve archived plans by ID.
- Returns `404` if the plan does not exist in the active campus.

Example request:

```http
GET /weekly-plans/11111111-1111-4111-a111-111111111111
Authorization: Bearer <JWT>
x-campus-id: 22222222-2222-4222-a222-222222222222
```

Example response:

```json
{
  "success": true,
  "message": "Weekly plan retrieved successfully",
  "data": {
    "id": "11111111-1111-4111-a111-111111111111",
    "campusId": "22222222-2222-4222-a222-222222222222",
    "classId": "33333333-3333-4333-a333-333333333333",
    "classroom": null,
    "weekStartDate": "2026-06-01T00:00:00.000Z",
    "theme": null,
    "blocks": [],
    "isArchived": false,
    "createdAt": "2026-06-18T13:00:00.000Z",
    "updatedAt": "2026-06-18T13:00:00.000Z"
  },
  "timestamp": "2026-06-18T13:00:00.000Z"
}
```

### `POST /weekly-plans`

Creates independent active weekly plans for one or more classes.

Request body:

| Field | Required | Notes |
| --- | --- | --- |
| `classIds` | Yes | Non-empty UUID array. No duplicates. |
| `weekStartDate` | Yes | Monday date anchor. Prefer `YYYY-MM-DD`. |
| `theme` | No | String max 255 after trim. `null`, blank, or omitted becomes `null`. |
| `blocks` | No | Flat schedule array. Omitted means empty schedule. |

Block request shape:

| Field | Required | Notes |
| --- | --- | --- |
| `dayOfWeek` | Yes | Integer `1..7`, where `1=Monday`, `7=Sunday`. |
| `startTime` | Yes | `HH:mm`. Use `00:00` through `23:59`. |
| `endTime` | Yes | `HH:mm`. `24:00` is allowed for end of day. Must be after `startTime`. |
| `activities` | Yes | Non-empty array. Each item has `text`. Order is array order. |

Activity request shape:

| Field | Required | Notes |
| --- | --- | --- |
| `text` | Yes | Required after trim. Max 500 characters. |

Example request:

```http
POST /weekly-plans
Authorization: Bearer <JWT>
x-campus-id: 22222222-2222-4222-a222-222222222222
Content-Type: application/json
```

```json
{
  "classIds": [
    "33333333-3333-4333-a333-333333333333",
    "66666666-6666-4666-a666-666666666666"
  ],
  "weekStartDate": "2026-06-01",
  "theme": "Community Helpers",
  "blocks": [
    {
      "dayOfWeek": 1,
      "startTime": "09:00",
      "endTime": "10:00",
      "activities": [
        { "text": "Morning Meeting" },
        { "text": "Centers" }
      ]
    },
    {
      "dayOfWeek": 1,
      "startTime": "10:00",
      "endTime": "10:30",
      "activities": [
        { "text": "Snack" }
      ]
    }
  ]
}
```

Example partial-success response:

```json
{
  "success": true,
  "message": "Weekly plans created successfully",
  "data": {
    "created": [
      {
        "id": "11111111-1111-4111-a111-111111111111",
        "campusId": "22222222-2222-4222-a222-222222222222",
        "classId": "33333333-3333-4333-a333-333333333333",
        "classroom": null,
        "weekStartDate": "2026-06-01T00:00:00.000Z",
        "theme": "Community Helpers",
        "blocks": [
          {
            "dayOfWeek": 1,
            "startTime": "09:00",
            "endTime": "10:00",
            "activities": [
              { "order": 0, "text": "Morning Meeting" },
              { "order": 1, "text": "Centers" }
            ]
          },
          {
            "dayOfWeek": 1,
            "startTime": "10:00",
            "endTime": "10:30",
            "activities": [
              { "order": 0, "text": "Snack" }
            ]
          }
        ],
        "isArchived": false,
        "createdAt": "2026-06-18T13:00:00.000Z",
        "updatedAt": "2026-06-18T13:00:00.000Z"
      }
    ],
    "skipped": [
      {
        "classId": "66666666-6666-4666-a666-666666666666",
        "reason": "ACTIVE_WEEKLY_PLAN_EXISTS",
        "message": "An active weekly plan already exists for this campus, class, and week"
      }
    ]
  },
  "timestamp": "2026-06-18T13:00:00.000Z"
}
```

If all classes are skipped for expected per-class reasons, the response is still `200` with `created: []` and `skipped: [...]`.

### `PATCH /weekly-plans/:id`

Updates one active weekly plan. Any supplied `blocks` array replaces the entire stored schedule.

Request body fields are all optional:

| Field | Required | Notes |
| --- | --- | --- |
| `classId` | No | Move plan to another active-campus class. |
| `weekStartDate` | No | New Monday date anchor. |
| `theme` | No | `null` or blank clears theme. Omitted leaves unchanged. |
| `blocks` | No | Full replacement schedule. Empty array clears schedule. Omitted leaves unchanged. |

Frontend should avoid sending an empty PATCH body because the backend will still treat it as an update and refresh `updatedAt`.

Example request:

```http
PATCH /weekly-plans/11111111-1111-4111-a111-111111111111
Authorization: Bearer <JWT>
x-campus-id: 22222222-2222-4222-a222-222222222222
Content-Type: application/json
```

```json
{
  "theme": null,
  "blocks": [
    {
      "dayOfWeek": 2,
      "startTime": "09:00",
      "endTime": "10:00",
      "activities": [
        { "text": "Outdoor Play" }
      ]
    }
  ]
}
```

Example response:

```json
{
  "success": true,
  "message": "Weekly plan updated successfully",
  "data": {
    "id": "11111111-1111-4111-a111-111111111111",
    "campusId": "22222222-2222-4222-a222-222222222222",
    "classId": "33333333-3333-4333-a333-333333333333",
    "classroom": null,
    "weekStartDate": "2026-06-01T00:00:00.000Z",
    "theme": null,
    "blocks": [
      {
        "dayOfWeek": 2,
        "startTime": "09:00",
        "endTime": "10:00",
        "activities": [
          { "order": 0, "text": "Outdoor Play" }
        ]
      }
    ],
    "isArchived": false,
    "createdAt": "2026-06-18T13:00:00.000Z",
    "updatedAt": "2026-06-18T13:05:00.000Z"
  },
  "timestamp": "2026-06-18T13:05:00.000Z"
}
```

Use this endpoint for frontend-local day copy: copy blocks from one day to another in UI state, then submit the full updated `blocks` array.

### `POST /weekly-plans/:id/copy`

Copies one active source plan to one or more destination classes and a destination Monday week.

Request body:

| Field | Required | Notes |
| --- | --- | --- |
| `classIds` | Yes | Destination class IDs. Non-empty UUID array. No duplicates. |
| `weekStartDate` | Yes | Destination Monday date anchor. |
| `theme` | No | Omit to preserve source theme. Send `null` or blank to clear. Send a string to override. |

Copied plans preserve all source blocks and activities.

Example request:

```http
POST /weekly-plans/11111111-1111-4111-a111-111111111111/copy
Authorization: Bearer <JWT>
x-campus-id: 22222222-2222-4222-a222-222222222222
Content-Type: application/json
```

```json
{
  "classIds": ["33333333-3333-4333-a333-333333333333"],
  "weekStartDate": "2026-06-08",
  "theme": "Spring Review"
}
```

Example response:

```json
{
  "success": true,
  "message": "Weekly plans copied successfully",
  "data": {
    "copied": [
      {
        "id": "77777777-7777-4777-8777-777777777777",
        "campusId": "22222222-2222-4222-a222-222222222222",
        "classId": "33333333-3333-4333-a333-333333333333",
        "classroom": null,
        "weekStartDate": "2026-06-08T00:00:00.000Z",
        "theme": "Spring Review",
        "blocks": [],
        "isArchived": false,
        "createdAt": "2026-06-18T13:00:00.000Z",
        "updatedAt": "2026-06-18T13:00:00.000Z"
      }
    ],
    "skipped": []
  },
  "timestamp": "2026-06-18T13:00:00.000Z"
}
```

### `DELETE /weekly-plans/:id`

Soft-archives one weekly plan.

Notes:

- The record remains readable by ID.
- Default list excludes it.
- It no longer blocks creating another active plan for the same class/week.
- Calling archive on an already archived plan returns the archived plan without another state change.

Example request:

```http
DELETE /weekly-plans/11111111-1111-4111-a111-111111111111
Authorization: Bearer <JWT>
x-campus-id: 22222222-2222-4222-a222-222222222222
```

Example response data has `isArchived: true`.

### `PATCH /weekly-plans/:id/restore`

Restores an archived plan when no active plan exists for the same campus, class, and week.

Example request:

```http
PATCH /weekly-plans/11111111-1111-4111-a111-111111111111/restore
Authorization: Bearer <JWT>
x-campus-id: 22222222-2222-4222-a222-222222222222
```

Possible outcomes:

- `200`: restored, response data has `isArchived: false`.
- `400`: plan is already active.
- `409`: another active plan now exists for the same class/week.

### Error Responses And Meanings

Errors use the project's NestJS exception response shape. The exact `message` may be a string or validation array, so UI should avoid depending on exact human text except for stable `skipped[].reason` values.

Example:

```json
{
  "statusCode": 400,
  "message": "weekStartDate must be a Monday",
  "error": "Bad Request"
}
```

Common statuses:

| Status | Meaning |
| --- | --- |
| `400` | Missing/invalid campus context, invalid UUID/date query, non-Monday `weekStartDate`, duplicate `classIds`, invalid theme, invalid blocks, overlapping blocks, archived source copy, archived plan update, restore of non-archived plan. |
| `401` | Missing or invalid JWT. |
| `403` | User lacks campus access, campus is archived, or user lacks required `weekly_plan.*` permission. |
| `404` | Weekly plan not found in active campus, source plan not found, class not found, or class belongs to another campus. |
| `409` | Active plan already exists for same campus/class/week, including race-condition duplicate prevention. |

Stable batch skipped reasons:

| Reason | Meaning |
| --- | --- |
| `CLASS_NOT_FOUND` | Destination class is missing or not in the active campus. |
| `ACTIVE_WEEKLY_PLAN_EXISTS` | Destination class/week already has an active weekly plan. |

## 3. Data Model And Field Details

### `WeeklyPlan`

| Field | Type | Required in response | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `id` | UUID string | Yes | No | Weekly plan ID. |
| `campusId` | UUID string | Yes | No | Backend-derived scope. Do not send in body. |
| `classId` | UUID string | Yes | No | Class the plan belongs to. |
| `classroom` | object | Yes | Yes | Class summary. Frontend should handle `null`. |
| `weekStartDate` | ISO string | Yes | No | Monday UTC midnight. Prefer sending `YYYY-MM-DD`. |
| `theme` | string | Yes | Yes | Max 255 after trim. `null` means no theme. |
| `blocks` | array | Yes | No | Flat array. Empty days are omitted. |
| `isArchived` | boolean | Yes | No | `false` by default. |
| `createdAt` | ISO timestamp | Yes | No | Server timestamp. |
| `updatedAt` | ISO timestamp | Yes | No | Server timestamp. |

### `classroom`

| Field | Type | Nullable |
| --- | --- | --- |
| `id` | UUID string | No |
| `name` | string | No |
| `gradeLevelId` | UUID string | Yes |
| `gradeLevelName` | string | Yes |
| `schoolYearId` | UUID string | Yes |
| `schoolYearName` | string | Yes |

### `blocks[]`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dayOfWeek` | number | Yes | `1=Monday`, `2=Tuesday`, ..., `7=Sunday`. |
| `startTime` | string | Yes | Response format `HH:mm`. |
| `endTime` | string | Yes | Response format `HH:mm`. |
| `activities` | array | Yes | Preserves frontend order through response `order`. |

Backend sorts response blocks by `dayOfWeek`, then `startTime`, then internal order. Do not assume response order equals request insertion order when times differ.

### `activities[]`

Request:

```json
{ "text": "Morning Meeting" }
```

Response:

```json
{ "order": 0, "text": "Morning Meeting" }
```

The frontend does not need to send `order`; backend derives order from the array index.

### Defaults And Nullability

- Create `theme` omitted, `null`, or blank becomes `null`.
- Update `theme` omitted means no change; `null` or blank clears it.
- Copy `theme` omitted preserves source theme; `null` or blank clears it; string overrides it.
- Create `blocks` omitted becomes `[]`.
- Update `blocks` omitted means no change; `[]` clears the schedule.
- `classroom` is nullable in responses; UI should not crash if it is `null`.
- Empty days are not represented. Frontend should group `blocks[]` by `dayOfWeek` and render missing days as empty.

## 4. Business Logic Handled By Backend

Backend handles:

- Authentication, campus access, active campus check, and `weekly_plan.*` permission checks.
- Class existence and campus ownership validation.
- Monday-only week anchor validation.
- `HH:mm` parsing and time normalization.
- `theme` trim, blank-to-null, and max length validation.
- Activity trim, required text validation, and max length validation.
- `dayOfWeek` validation for `1..7`, including Saturday and Sunday.
- `startTime < endTime` validation.
- Same-day overlap rejection.
- Adjacent block allowance, for example `09:00-10:00` and `10:00-10:30` is valid.
- Response sorting for blocks.
- Active-only duplicate prevention using both application checks and a database partial unique index.
- Batch create/copy partial success for class-level destination issues.
- Full schedule replacement on update inside one persistence operation.
- Archive and restore state transitions.
- Restore conflict checks when another active plan exists.
- Transaction-bound audit events for create, copy, update, archive, and restore.

Audit actions emitted:

- `CREATE_WEEKLY_PLAN`
- `COPY_WEEKLY_PLAN`
- `UPDATE_WEEKLY_PLAN`
- `ARCHIVE_WEEKLY_PLAN`
- `RESTORE_WEEKLY_PLAN`

## 5. Business Logic Frontend Still Needs To Handle

Frontend should still handle:

- Grouping flat `blocks[]` by `dayOfWeek` for display.
- Rendering empty days because backend omits days without blocks.
- Choosing whether to show weekdays only or all `1..7`; backend accepts all seven days.
- Inline validation for a better UX before submit, especially Monday week selection, time order, overlap warnings, and required activity text.
- Day-copy behavior in local state followed by `PATCH /weekly-plans/:id` with the full replacement `blocks` array.
- Encoding list `filter` as JSON string in the query string.
- Displaying partial-success results from create/copy. Do not assume every requested class was created/copied.
- Handling `data.plan === null` from active lookup as the normal empty state.
- Handling `classroom === null` defensively.
- Refreshing the current plan after create/copy/update/archive/restore if UI depends on server-normalized order/timestamps.
- Avoiding empty PATCH requests.

Frontend should not assume anymore:

- That Weekly Plan is frontend-local only. It is now persisted by backend.
- That Meal Menu fallback/effective semantics apply. Weekly Plan lookup is exact class/week only.
- That `campusId` can be sent in the request body.
- That class conflicts fail the whole batch. Expected per-class conflicts are returned in `skipped[]`.
- That cross-campus classes get a separate reason. They are treated as not found and skipped as `CLASS_NOT_FOUND` in batch flows.
- That there is a server endpoint for day copy.
- That update is granular per block or activity. It is full schedule replacement when `blocks` is supplied.

## 6. Known Issues And Follow-Ups

### Not Finished Or Intentionally Out Of Scope

- No dedicated day-copy endpoint. Use frontend-local copy plus `PATCH /weekly-plans/:id`.
- No granular block/activity create/update/delete endpoints. Use full `blocks` replacement.
- No recurrence/template generation across many future weeks.
- No optimistic concurrency token or ETag. Duplicate active class/week is protected, but general update conflicts are last-write-wins.
- No frontend-specific role assignment changes were made. Permissions exist in the RBAC catalog; users still need roles that grant them.

### Technical Debt Or Risks

- The implementation intentionally collapses missing class and cross-campus class into `CLASS_NOT_FOUND` for batch skips. This differs from the earlier possible `CLASS_NOT_IN_CAMPUS` reason in the research/spec notes.
- Response `weekStartDate` is an ISO timestamp at UTC midnight even though the feature is date-only. Frontend should treat it as a date anchor, not as a local datetime.
- `generated/audit-actions.json` is now an explicitly trackable generated artifact because tests use it as a drift guard. Frontend audit tooling can consume it if needed, but normal Weekly Plan integration does not need it.
- List filters follow the shared JSON filter contract. Malformed filter JSON or unsupported filter fields return `400` before the controller runs.
- Error human messages are useful for debugging but should not be treated as a stable API, except for `skipped[].reason`.

### Practical Integration Path

1. Use `GET /weekly-plans/active?classId=...&weekStartDate=YYYY-MM-DD` to load the editor.
2. If `plan` is `null`, create with `POST /weekly-plans` for the selected class.
3. For editing an existing plan, maintain a full `blocks[]` array in UI state and send it with `PATCH /weekly-plans/:id`.
4. For whole-week copy, call `POST /weekly-plans/:id/copy` and show both `copied[]` and `skipped[]` results.
5. For day-copy, duplicate blocks locally between `dayOfWeek` values and save through update.
6. For archive/restore UI, use `DELETE /weekly-plans/:id` and `PATCH /weekly-plans/:id/restore`, then refresh list/detail state.
