---
title: Parent Request Center Absence Requests Frontend Handoff
description: Frontend-to-backend handoff for Parent Request Center Absence Requests, updated with implemented frontend surfaces and parent self-service auth follow-up.
createdAt: '2026-06-26T15:25:50.525Z'
updatedAt: '2026-06-27T17:19:09.751Z'
tags:
  - frontend-handoff
  - parent-request-center
  - absence-requests
  - api
  - auth
  - follow-up
---

## Purpose

This handoff explains what the frontend has built for Parent Request Center v1 and what backend support or follow-up may be needed. It is intentionally written from the frontend perspective. It does not prescribe backend implementation details, internal data-layer design, or backend code.

Frontend source spec: `D:\Code\Kindercare\frontend\.knowns\docs\specs\2026-06-26\parent-request-center-absence-requests`

Frontend implementation paths currently involved:

- `D:\Code\Kindercare\frontend\src\app\dashboard\requests`
- `D:\Code\Kindercare\frontend\src\features\absence-requests`
- `D:\Code\Kindercare\frontend\src\features\campuses\hooks\use-auth-me.ts`
- `D:\Code\Kindercare\frontend\src\components\app-wide
av
av-config.ts`

Observed backend integration issue to investigate:

- Parent history currently shows `Could not load request history` with backend message `Authenticated user is required` for a parent user.
- The frontend request path is `GET /api/absence-requests/mine` with normal auth and campus context.
- This appears related to backend current-user hydration on parent/self-service routes that use campus context but intentionally do not use admin RBAC campus-access checks.
- The same risk may affect `GET /api/guardians/me/students` and `POST /api/absence-requests` because those are also parent/self-service routes that need the authenticated domain user.

## 1. Feature Summary

### What Feature We Are Building

We are building v1 of a Parent Request Center. Absence Requests are the active workflow in v1. Medical Instructions should appear as disabled or coming later, but no medical-instruction submission or review workflow is included in this release.

Parents/guardians submit absence requests for their linked children in the current campus. Admin/staff users review campus requests and approve or deny them.

### Why We Are Building It

The system needs a structured place for parent-originated requests. Absence requests are the first workflow because they are common, operationally important, and need an auditable review state. This also creates a reusable foundation for later request types such as Medical Instructions.

### Main User Flow From The Frontend Perspective

Parent flow:

1. Parent signs in and opens the authenticated dashboard.
2. Parent opens Parent Request Center from dashboard navigation.
3. Parent sees Absence Requests as active and Medical Instructions as coming later.
4. Parent opens New Absence Request.
5. Frontend loads children linked to the current guardian in the selected campus.
6. Parent chooses a child.
7. Parent chooses Full Day or Partial Day.
8. Parent enters date/date range or partial-day time range.
9. Parent enters a required description.
10. Parent submits the request.
11. Parent history shows the request as `PENDING`.
12. After admin review, parent history shows `APPROVED` or `DENIED`, with review note when present.

Admin flow:

1. Admin opens Parent Request Center.
2. Admin sees Review Absence Requests if they have admin list permission.
3. List defaults to requests whose absence period overlaps today.
4. Admin can filter by status/date and can use Unresponded, which maps to `PENDING`.
5. Admin can approve or deny pending requests.
6. Review action updates the request status and refetches relevant frontend lists.

## 2. Frontend Spec Summary

### Screens And Components Involved

Implemented frontend surfaces:

- Dashboard route: `D:\Code\Kindercare\frontend\src\app\dashboard\requests`
- Parent Request Center page shell: `D:\Code\Kindercare\frontend\src\features\absence-requests\components\parent-request-center-page.tsx`
- Parent create dialog: `D:\Code\Kindercare\frontend\src\features\absence-requests\components\absence-request-create-dialog.tsx`
- Parent history: `D:\Code\Kindercare\frontend\src\features\absence-requests\components\parent-absence-request-history.tsx`
- Admin list: `D:\Code\Kindercare\frontend\src\features\absence-requests\components\admin-absence-requests-table.tsx`
- Admin review dialog: `D:\Code\Kindercare\frontend\src\features\absence-requests\components\absence-request-review-dialog.tsx`
- Frontend API services/hooks: `D:\Code\Kindercare\frontend\src\features\absence-requests`

Navigation:

- A Requests item was added to the existing dashboard navigation.
- Route is available at `/dashboard/requests`.

### Important UI States

Parent states:

- Parent Request Center loading while auth/profile/campus context loads.
- Absence Requests active card.
- Medical Instructions disabled/coming-later card.
- Child selector loading.
- No linked children.
- Child selector failure.
- Form idle, dirty, submitting, success, failure.
- Parent history loading.
- Parent history empty.
- Parent history failure.
- Parent history with `PENDING`, `APPROVED`, and `DENIED` requests.
- Review note display when present.

Admin states:

- Admin review unavailable when missing list permission.
- Admin list loading.
- Admin default-today empty state.
- Filtered empty state.
- Admin list failure.
- Pagination/loading during refetch.
- Pending row with approve/deny actions when update permission is available.
- Non-pending row without review actions.
- Review dialog open/submitting/success/failure.
- Terminal-state failure when another admin has already reviewed a request.

### User Actions We Need To Support

Parent actions:

- Open request center.
- Open absence request create dialog.
- Select linked child.
- Choose full-day request.
- Choose partial-day request.
- Submit single-day full-day request.
- Submit multi-day full-day request.
- Submit partial-day same-date request with `HH:mm` times.
- View own request history.

Admin actions:

- View campus absence requests.
- Use default today overlap view.
- Filter by status.
- Filter by overlap date.
- Use Unresponded filter as `PENDING`.
- Approve pending request.
- Deny pending request with optional note.

Out of scope for v1:

- Parent edit.
- Parent cancel.
- Medical Instructions workflow.
- Automatic attendance mutation on approval.

### Validation Or Business Rules Assumed On The Frontend

Frontend validates these before submit where practical, but backend must remain authoritative:

- Student is required.
- Absence type is required.
- Description is required.
- Description max length is 1,000 characters.
- Start date cannot be in the past.
- Full-day end date cannot be before start date.
- Partial-day requests use one date only.
- Partial-day start time and end time are required.
- Partial-day end time must be after start time.
- Full-day requests omit time fields.
- Parent create payload never sends `guardianId`; backend should resolve guardian from authenticated user.
- New requests should start as `PENDING`.
- Parent history is unpaginated in the current frontend implementation.
- Parent UI shows generic reviewer copy, not a staff name dependency.
- Admin review sends only `APPROVED` or `DENIED`, never `PENDING`.
- Denial note is optional.
- Approval/denial should not mutate attendance in v1.

## 3. Backend Needs / Assumptions

### What Data The Frontend Needs

Parent child selector:

| Field | Required | Notes |
| --- | --- | --- |
| Student id | Yes | Used as form value. |
| Student full name | Yes | Display label. |
| Student code | Optional | Used for disambiguation when present. |
| Guardian relationship id/name | Useful | Display context in selector. |

Absence request display:

| Field | Required | Notes |
| --- | --- | --- |
| Request id | Yes | Row key and review target. |
| Campus id | Yes | Cache scoping and safety. |
| Student id | Yes | Request association. |
| Student summary | Yes | Parent/admin display. |
| Requester guardian id | Yes | Admin/audit context. |
| Requester guardian summary | Yes for admin | Parent can tolerate missing summary but admin list needs it. |
| Absence type | Yes | Full-day or partial-day display. |
| Start date | Yes | Display and filtering. |
| End date | Yes for full-day | Range display and overlap filtering. |
| Start time | Conditional | Partial-day display. |
| End time | Conditional | Partial-day display. |
| Description | Yes | Parent explanation. |
| Status | Yes | Display, filters, allowed actions. |
| Reviewed by id/summary | Optional | Generic frontend copy can be used if weak. |
| Reviewed at | Optional | Shown after review. |
| Review note | Optional | Shown when present. |
| Created at | Yes | Submitted time. |
| Updated at | Useful | Table freshness/audit display if needed. |

### What Actions The Frontend Needs To Perform

- Fetch current guardian's linked students in the selected campus.
- Create a pending absence request as the current guardian.
- Fetch current guardian's absence request history.
- Fetch admin campus-scoped absence request list.
- Filter admin list by status and overlap date.
- Approve a pending absence request.
- Deny a pending absence request with optional note.

### Existing APIs We Think May Be Reusable

The frontend is currently wired to these endpoints:

- `GET /api/guardians/me/students`
- `POST /api/absence-requests`
- `GET /api/absence-requests/mine`
- `GET /api/absence-requests`
- `GET /api/absence-requests/:id`
- `PATCH /api/absence-requests/:id/review`

Existing backend systems likely involved and worth confirming:

- Authenticated user resolution.
- Campus context extraction from request header.
- Guardian profile lookup for the authenticated user.
- Guardian-to-student relationship lookup in a campus.
- Existing standard response wrapper.
- Existing pagination/filtering conventions.
- Existing RBAC permissions for admin list/read/update.

### New Or Changed APIs We May Need

The API surface appears mostly aligned with the frontend. The current backend follow-up appears to be less about new endpoints and more about ensuring parent/self-service endpoints reliably hydrate the authenticated backend user before guardian resolution.

Potential backend changes to investigate:

- A reusable backend policy or route-level mechanism for parent/self-service routes that need authenticated user hydration but should not require admin RBAC campus access.
- Stable behavior for `GET /api/absence-requests/mine`, `GET /api/guardians/me/students`, and `POST /api/absence-requests` for guardian accounts.
- Consistent error responses that distinguish unauthenticated, authenticated-but-not-a-guardian, missing campus, and unlinked-student cases.

### Backend Behavior We Are Assuming But Have Not Confirmed

- Parent/self-service routes should use authentication plus guardian/student relationship checks, not admin RBAC permissions.
- Admin routes should continue using RBAC permissions.
- The backend can resolve the authenticated user to a guardian profile in the current campus.
- The backend can validate that a selected student is linked to that guardian in the current campus.
- `PENDING`, `APPROVED`, and `DENIED` are the only v1 statuses.
- `APPROVED` and `DENIED` are terminal for v1.
- Overlapping active requests for the same student should be rejected.
- Denied requests do not block resubmission.
- Parent history can remain unpaginated for v1.
- Admin list remains paginated.
- Admin default date filtering uses absence-period overlap, not submitted date.
- Approval/denial does not mutate attendance.

## 4. Suggested API Contract

This section documents the frontend-facing contract currently expected by the implemented UI. Backend can adjust internals and naming if needed, but field semantics should stay stable enough for frontend services.

### Proposed Endpoints

| Frontend need | Endpoint currently expected | Notes |
| --- | --- | --- |
| Current guardian children | `GET /api/guardians/me/students` | Authenticated guardian, current campus. |
| Create absence request | `POST /api/absence-requests` | Authenticated guardian, current campus. |
| Parent request history | `GET /api/absence-requests/mine` | Authenticated guardian, current campus. |
| Admin request list | `GET /api/absence-requests` | Campus-scoped, RBAC-gated, paginated. |
| Admin request detail | `GET /api/absence-requests/:id` | RBAC-gated if detail view is used. |
| Admin review | `PATCH /api/absence-requests/:id/review` | RBAC-gated update action. |

### Request Payloads

Create absence request payload:

| Field | Required | Notes |
| --- | --- | --- |
| `studentId` | Yes | Must be linked to current guardian in current campus. |
| `absenceType` | Yes | Expected values are `FULL_DAY` or `PARTIAL_DAY`. |
| `startDate` | Yes | Date-only value from frontend. |
| `endDate` | Conditional | Sent for full-day requests; same as start date for single-day full-day. |
| `startTime` | Conditional | Sent for partial-day requests only. |
| `endTime` | Conditional | Sent for partial-day requests only. |
| `description` | Yes | Required explanation, max 1,000 chars from frontend. |

Review absence request payload:

| Field | Required | Notes |
| --- | --- | --- |
| `status` | Yes | `APPROVED` or `DENIED` only. |
| `reviewNote` | No | Optional, max 1,000 chars from frontend. |

Admin list query parameters:

| Query | Required | Notes |
| --- | --- | --- |
| `limit` | Yes | Standard pagination. |
| `offset` | Yes | Standard pagination. |
| `sort` | Preferred | Frontend sends newest-created first. |
| `status` | Optional | Used for status filters and Unresponded. |
| `overlapsDate` | Yes for default view | Frontend sends today's local date by default. |

### Response Shapes

Current guardian students response should provide:

| Field | Required | Notes |
| --- | --- | --- |
| `student.id` | Yes | Selector value. |
| `student.fullName` | Yes | Selector display. |
| `student.studentCode` | Optional | Selector disambiguation. |
| `guardianRelationship.id` | Useful | Relationship context. |
| `guardianRelationship.name` | Useful | Selector label context. |

Absence request response should provide:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | Yes | Request identity. |
| `campusId` | Yes | Campus safety/cache context. |
| `studentId` | Yes | Association. |
| `student` | Nullable but preferred | UI falls back if missing, but normal response should include it. |
| `requesterGuardianId` | Yes | Requester identity. |
| `requesterGuardian` | Nullable but preferred | Admin list uses it. |
| `absenceType` | Yes | Full-day/partial-day display. |
| `startDate` | Yes | Display/filter. |
| `endDate` | Yes | Display/filter. |
| `startTime` | Nullable | Partial-day only. |
| `endTime` | Nullable | Partial-day only. |
| `description` | Yes | Display. |
| `status` | Yes | Display/actions. |
| `reviewedById` | Nullable | Review metadata. |
| `reviewedBy` | Nullable | Frontend does not depend on polished reviewer name. |
| `reviewedAt` | Nullable | Review metadata. |
| `reviewNote` | Nullable | Parent/admin display when present. |
| `createdAt` | Yes | Submitted time. |
| `updatedAt` | Yes | Freshness/audit if needed. |

### Error States The Frontend Needs To Handle

Frontend currently needs stable errors for:

- Unauthenticated user.
- Authenticated user not resolvable to backend user.
- Current user is not a guardian in this campus.
- Missing or invalid campus context.
- Student is not linked to current guardian in this campus.
- Past start date.
- Invalid full-day date range.
- Invalid partial-day time range.
- Description missing or too long.
- Overlapping active request conflict.
- Admin missing list/read/update permission.
- Request not found.
- Request belongs to another campus.
- Request already reviewed by another admin.
- Generic server failure.

Current observed failure to investigate:

- Parent history returns `Authenticated user is required` even though the user is signed in as a parent.
- From frontend perspective, expected behavior is either successful parent history or a more specific authenticated-but-not-guardian / not-linked / campus-related response.

### Loading, Empty, Success, Failure Cases

Parent cases:

- Child selector loading.
- No linked children.
- Child selector load failure.
- Request submit loading.
- Request created successfully.
- Request creation failure.
- Parent history loading.
- Parent history empty.
- Parent history failure.

Admin cases:

- Admin list loading.
- No requests for today's default view.
- No requests for selected filters.
- Admin list failure.
- Review action loading.
- Review succeeded.
- Review failed because request changed status.
- Review failed because user lacks permission.

## 5. Data Requirements

### Fields Needed By The UI

Parent create UI:

| Field | Required | Source |
| --- | --- | --- |
| Current campus id | Yes | Frontend campus context header. |
| Current guardian identity | Yes | Backend auth/profile resolution. |
| Linked student id | Yes | Current guardian students endpoint. |
| Linked student full name | Yes | Current guardian students endpoint. |
| Linked student code | Optional | Current guardian students endpoint. |
| Relationship display | Optional | Current guardian students endpoint. |

Parent/admin display UI:

| Field | Required | Notes |
| --- | --- | --- |
| Request id | Yes | Key/action target. |
| Student summary | Yes | Display. |
| Requester summary | Yes for admin | Display. |
| Absence type | Yes | Display. |
| Period dates/times | Yes | Display/filtering. |
| Description | Yes | Display. |
| Status | Yes | Badge/action logic. |
| Submitted timestamp | Yes | Display/sort. |
| Reviewed timestamp | Optional | Display after review. |
| Review note | Optional | Display when present. |

### Which Fields Are Required Vs Optional

Required on create:

- Student id.
- Absence type.
- Start date.
- Description.
- End date for full-day payloads from frontend.
- Start/end time for partial-day payloads.

Optional on create:

- No optional business fields from the frontend perspective beyond fields that do not apply to the selected absence type.

Required on review:

- Request id in route.
- Review status (`APPROVED` or `DENIED`).

Optional on review:

- Review note.

Optional on display:

- Student code.
- Reviewer display data.
- Review note.

### Filtering, Sorting, Pagination, Permissions, Status Logic

Filtering/sorting/pagination:

- Parent history is currently expected as unpaginated and newest first.
- Admin list is paginated.
- Admin list supports status filter.
- Admin list supports overlap-date filter.
- Admin default list sends `overlapsDate=<today>` explicitly.
- Admin Unresponded sends `status=PENDING`.
- Frontend avoids sending both top-level `status` and a filter status object at the same time.

Permissions and authorization model:

- Parent access should be separate from admin RBAC.
- Parent access should be based on authenticated user -> guardian profile -> current campus -> student relationship -> own request scope.
- Admin access should be based on RBAC permissions for list/read/update.
- Parent create should not require admin `absence_request.create` permission.
- Admin list should require list permission.
- Admin review should require update permission.

Status logic:

- New requests are `PENDING`.
- Only `PENDING` requests can be approved or denied.
- `APPROVED` and `DENIED` are terminal in v1.
- Denial note is optional.
- Denied requests should not block resubmission if backend overlap checks exist.

## 6. Questions For Backend

1. What is the preferred backend pattern for parent/self-service endpoints that need the authenticated domain user but should not require admin RBAC campus access?
2. Should backend introduce or reuse a route-level policy that hydrates current user for these self-service routes before controller methods read current user?
3. Should `GET /api/guardians/me/students`, `POST /api/absence-requests`, and `GET /api/absence-requests/mine` all share the same parent/self-service authorization policy?
4. Should parent/self-service endpoints use guardian relationship checks only, or should there also be a lightweight campus membership check for guardian users?
5. What should the backend return when the authenticated user exists but has no guardian profile in the selected campus?
6. What should the backend return when the user is a guardian but has no linked children?
7. Should parent history remain unpaginated for v1, or should backend expose pagination now for future scale?
8. Are date-only strings interpreted in campus timezone, server timezone, or date-only semantics without timezone?
9. Should overlap checking block only `PENDING` and `APPROVED`, while allowing resubmission after `DENIED`?
10. Should admin reviewer display data be returned to parents, or should frontend continue using generic `Reviewed by staff` copy?
11. Are review notes visible to parents for both approvals and denials?
12. Do admin review actions need audit metadata beyond `reviewedBy`, `reviewedAt`, and `reviewNote`?
13. Are there seed/backfill requirements for `absence_request.list`, `absence_request.read`, and `absence_request.update` permissions?
14. Should backend expose a distinct error for already-reviewed terminal-state conflicts so frontend can show a clear retry/refetch message?
15. Can backend confirm approval/denial does not create or update attendance records in v1?

## 7. Risks / Dependencies

### Areas Where Frontend Work Depends On Backend Decisions

- Parent/self-service auth policy and current-user hydration.
- Exact parent endpoint behavior for guardian users without RBAC campus role assignments.
- Stable response shape for request list/history/review.
- Status and overlap behavior.
- Parent visibility of review notes.
- Permission names and seed availability for admin review.

### Possible Technical Debt Or Migration Concerns

- If parent endpoints rely on admin RBAC checks, legitimate guardian users may be blocked.
- If parent endpoints skip user hydration but still depend on current user, requests can fail with misleading auth errors.
- If every self-service endpoint manually resolves user/guardian differently, future request types such as Medical Instructions may repeat the same bug.
- If date handling is not standardized, today-overlap filtering can drift across client/server/campus timezone boundaries.
- If absence requests are coupled to attendance too early, v1 approval behavior may create operational side effects the frontend does not expect.

### Anything That Could Change Frontend Implementation

Frontend implementation may need changes if backend decides:

- Parent history must be paginated immediately.
- Parent request creation requires a different endpoint or payload shape.
- Child selector data comes from a different endpoint.
- Date/time fields must be full datetimes instead of date plus `HH:mm` fields.
- Review notes are admin-only and should not be returned to parent history.
- Admin review uses separate approve/deny endpoints rather than one review endpoint.
- Medical Instructions should not appear at all until backend work begins.

## 8. Acceptance Criteria From Frontend Perspective

Backend work unblocks/fully supports the frontend when these are true:

- A signed-in guardian can open `/dashboard/requests` and load parent history without `Authenticated user is required`.
- A signed-in guardian can load linked students for the current campus.
- A signed-in guardian with no linked students receives an empty-state response the frontend can display.
- A signed-in guardian can create a full-day single-date absence request for a linked child.
- A signed-in guardian can create a full-day multi-date absence request for a linked child.
- A signed-in guardian can create a partial-day same-date absence request for a linked child.
- Backend rejects requests for students not linked to the current guardian in the current campus.
- Backend rejects invalid dates, invalid partial-day time order, overlong descriptions, and overlapping active requests.
- Created requests return `PENDING` and appear in parent history.
- Admin users with list permission can load paginated campus absence requests.
- Admin list supports `overlapsDate=<today>` for the default today view.
- Admin list supports `status=PENDING` for Unresponded.
- Admin users with update permission can approve pending requests.
- Admin users with update permission can deny pending requests without a reason.
- Backend prevents approving or denying already-terminal requests.
- Parent history reflects reviewed status, reviewed time, and review note when available.
- Permission failures and validation failures return stable messages/statuses the frontend can display.
- Approval/denial does not mutate attendance records in v1.

Frontend can verify backend completion by testing these cases through the implemented frontend route and service layer:

- Parent with linked child opens `/dashboard/requests` and sees history.
- Parent opens New Absence Request and sees linked children.
- Parent submits full-day request and sees it in history as `PENDING`.
- Parent submits partial-day request and sees it in history as `PENDING`.
- Parent with no linked children sees the no-child state.
- Admin opens `/dashboard/requests` and sees today's admin list.
- Admin uses Unresponded and receives pending requests only.
- Admin approves a pending request and parent history updates.
- Admin denies a pending request without a note and parent history updates.
- Admin attempts to review an already-reviewed request and frontend receives a handled failure.
