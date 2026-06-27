---
title: Parent Request Center Absence Requests Backend
description: Specification for backend support of Parent Request Center absence requests.
createdAt: '2026-06-26T16:21:02.751Z'
updatedAt: '2026-06-26T16:24:23.815Z'
tags:
  - spec
  - approved
  - parent-request-center
  - absence-requests
---

# Parent Request Center Absence Requests Backend

## Overview

Build backend support for Parent Request Center absence requests. Parents can select one of their linked children, submit a full-day or partial-day absence request, view their submitted requests, and see admin review notes. Campus staff can list campus requests, filter by status and absence date overlap, view request details, and approve or deny pending requests.

This is a new backend vertical slice named `absence-request` with route base `absence-requests`. V1 stores and reviews absence requests only; it must not create, update, or infer attendance records.

Supporting research: @doc/research/parent-request-center-absence-requests-backend-research

## Locked Decisions

- D1: Parent-facing endpoints use profile relationship authorization. The backend validates campus context, resolves the current user's active guardian profile in that campus, and authorizes child access through the guardian-student relationship. Parent endpoints do not require seeded parent campus roles in v1.
- D2: Admin date filtering uses an explicit frontend-supplied `overlapsDate=YYYY-MM-DD`. The backend applies absence-period overlap filtering and does not infer campus-local "today" for list filtering.
- D3: V1 rejects overlapping active absence requests for the same student. `PENDING` and `APPROVED` requests block overlapping new submissions; `DENIED` requests do not.
- D4: Parents cannot submit requests for past dates.
- D5: V1 does not enforce a maximum full-day date span beyond `endDate >= startDate`.
- D6: V1 does not enforce an advance-submission limit for future requests.
- D7: Admin review notes are visible to parents in request history/detail whenever a note is present, for both approved and denied requests.
- D8: Admin approve/deny requires `absence_request.update`.
- D9: Parent description and admin review note each have a 1,000 character maximum.
- D10: The backend uses the server UTC date as canonical "today" for the no-past-dates validation rule. Campus-local validation is out of scope until campuses model timezone data.
- D11: The current parent child selector route is `GET /guardians/me/students`, deriving the guardian from the authenticated user and campus context.

## Requirements

### Functional Requirements

- FR-1: Add an `AbsenceRequest` persistence model mapped to `absence_request`, scoped by campus, student, requesting guardian, and optionally requester user, with request type, date/time fields, description, status, review metadata, and timestamps.
- FR-2: Store absence dates as date-only values. Partial-day time-of-day values must use `HH:mm` in API payloads and be stored internally as minute-of-day integers.
- FR-3: Support absence request statuses `PENDING`, `APPROVED`, and `DENIED`. New requests must always start as `PENDING`; `APPROVED` and `DENIED` are terminal in v1.
- FR-4: Add RBAC module support for `absence_request`, including seeded permissions for `absence_request.list`, `absence_request.read`, `absence_request.create`, and `absence_request.update`. Admin review must require `absence_request.update`; parent create must use D1 profile authorization rather than requiring parent campus roles.
- FR-5: Add `GET /guardians/me/students` for the authenticated parent to retrieve active linked students in the selected campus. The route must derive the guardian from the current user and campus; it must not accept a client-provided guardian id.
- FR-6: Add `POST /absence-requests` for a parent to create a request for a linked child in the selected campus.
- FR-7: Parent creation validation must enforce campus from request context, active guardian profile in campus, linked student in campus, required trimmed description up to 1,000 characters, required absence type, valid date/time shape, no past start date using server UTC date, and no overlap with active requests for the same student.
- FR-8: Full-day requests require `startDate` and `endDate`, require `endDate >= startDate`, and must not require partial-day times.
- FR-9: Partial-day requests require a single absence date, `startTime`, and `endTime`; `endTime` must be later than `startTime`.
- FR-10: Add `GET /absence-requests/mine` for the authenticated parent to list their own requests in the selected campus, newest submitted first, with review status and parent-visible review note when present.
- FR-11: Add `GET /absence-requests` for campus staff to list campus-scoped absence requests with standard pagination. The list must support status filtering and `overlapsDate=YYYY-MM-DD` filtering where a request matches when `startDate <= overlapsDate <= endDate`.
- FR-12: Add `GET /absence-requests/:id` for campus staff to read one campus-scoped request by id.
- FR-13: Add `PATCH /absence-requests/:id/review` for campus staff to approve or deny a pending request. The route must set status, reviewer user, review timestamp, and optional trimmed review note up to 1,000 characters.
- FR-14: Review transitions must reject attempts to review non-pending requests. Approved and denied requests cannot be re-reviewed or moved back to pending in v1.
- FR-15: Absence request create and review flows must not create or update attendance records, attendance summaries, or attendance status values.
- FR-16: Response DTOs must expose enough data for the frontend handoff: request id, student summary, requesting guardian summary where relevant, absence type, date range, partial-day times, description, status, created timestamp, reviewer summary where relevant, reviewed timestamp, and parent-visible review note.

### Non-Functional Requirements

- NFR-1: All request access must be campus-scoped. A user must not read, create, list, or review absence requests across campuses through id guessing or filters.
- NFR-2: Parent endpoints must never trust `guardianId` from request body, params, or query. Guardian identity must be resolved from authenticated user plus campus context.
- NFR-3: Admin endpoints must follow existing controller, standard response, pagination, repository, and RBAC conventions used by recent feature slices such as Weekly Plan.
- NFR-4: Overlap detection must be enforced in the application or repository layer with a transactional or otherwise race-conscious path appropriate for the existing persistence conventions.
- NFR-5: Validation failures must return existing API error patterns and should distinguish unauthenticated, unauthorized, not found, conflict, and invalid payload cases where the codebase already has equivalents.
- NFR-6: The implementation must include focused automated tests for domain invariants, authorization, persistence scope, endpoint validation, review transitions, and no-attendance-mutation behavior.

## Acceptance Criteria

- [ ] AC-1: Database schema and repository support `AbsenceRequest` with campus, student, requester guardian, status, date/time, description, review metadata, timestamps, and indexes for campus/status, campus/date overlap, campus/createdAt, requester guardian/createdAt, and student/date overlap checks.
- [ ] AC-2: `GET /guardians/me/students` returns only students linked to the current user's active guardian profile in the selected campus and rejects users with no matching active guardian profile.
- [ ] AC-3: A parent can create a valid full-day request for their linked child; the persisted request is `PENDING` and contains no attendance side effects.
- [ ] AC-4: A parent can create a valid partial-day request with `HH:mm` times for one date; invalid or reversed times are rejected.
- [ ] AC-5: Parent create rejects past start dates using server UTC date, unlinked students, students outside the selected campus, blank or overlong descriptions, invalid date ranges, and active overlapping requests for the same student.
- [ ] AC-6: `GET /absence-requests/mine` returns only the current guardian's selected-campus requests, newest first, including parent-visible review notes when present.
- [ ] AC-7: `GET /absence-requests` returns only selected-campus requests, supports standard pagination, supports status filtering, and supports `overlapsDate` filtering for date-range overlap.
- [ ] AC-8: `GET /absence-requests/:id` enforces campus scope and admin read permission.
- [ ] AC-9: `PATCH /absence-requests/:id/review` allows staff with `absence_request.update` to approve or deny pending requests, records reviewer and review timestamp, returns the updated request, and rejects non-pending requests.
- [ ] AC-10: Review notes up to 1,000 characters are persisted and visible to parents; notes longer than 1,000 characters are rejected.
- [ ] AC-11: RBAC validation and seed tests cover the new `absence_request` module and permissions.
- [ ] AC-12: Automated tests cover the acceptance criteria and confirm absence request flows do not invoke attendance writes.

## Scenarios

### Scenario 1: Parent Submits Full-Day Absence

**Given** an authenticated parent has an active guardian profile in the selected campus and a linked student in that campus
**When** the parent submits `POST /absence-requests` with `absenceType=FULL_DAY`, valid `startDate`, valid `endDate`, and a description
**Then** the backend creates a `PENDING` absence request for that student and campus
**And** no attendance record or summary is created or updated.

### Scenario 2: Parent Submits Partial-Day Absence

**Given** an authenticated parent has a linked student in the selected campus
**When** the parent submits `POST /absence-requests` with `absenceType=PARTIAL_DAY`, one date, `startTime=09:00`, `endTime=12:30`, and a description
**Then** the backend stores the date and minute-of-day values and returns the request with `HH:mm` times.

### Scenario 3: Parent Has No Campus Guardian Profile

**Given** an authenticated user has no active guardian profile for the selected campus
**When** the user calls `GET /guardians/me/students` or `POST /absence-requests`
**Then** the backend rejects the request using the existing unauthorized or forbidden error pattern.

### Scenario 4: Parent Attempts Cross-Student Or Cross-Campus Request

**Given** a parent is authenticated for a selected campus
**When** the parent submits a request for a student not linked to their guardian profile or not in the selected campus
**Then** the backend rejects the request and does not reveal cross-campus request details.

### Scenario 5: Active Overlap Is Blocked

**Given** a student already has a `PENDING` or `APPROVED` absence request for a period
**When** the parent submits another request whose date/time period overlaps that active request
**Then** the backend rejects the new request as a conflict.

### Scenario 6: Denied Request Does Not Block Resubmission

**Given** a student has a `DENIED` absence request for a period
**When** the parent submits a new valid request for the same or overlapping period
**Then** the backend allows the new request if no `PENDING` or `APPROVED` request overlaps.

### Scenario 7: Staff Lists Requests For A Date

**Given** campus staff has list access for the selected campus
**When** staff calls `GET /absence-requests?overlapsDate=2026-07-10&status=PENDING`
**Then** the backend returns only selected-campus pending requests whose absence period includes July 10, 2026.

### Scenario 8: Staff Reviews A Pending Request

**Given** campus staff has `absence_request.update` in the selected campus and a request is `PENDING`
**When** staff calls `PATCH /absence-requests/:id/review` with `status=APPROVED` or `status=DENIED` and an optional note
**Then** the backend records the terminal status, reviewer, review timestamp, and note
**And** the note is visible on parent history/detail responses.

### Scenario 9: Staff Attempts To Re-Review A Terminal Request

**Given** an absence request is already `APPROVED` or `DENIED`
**When** staff calls the review endpoint again
**Then** the backend rejects the transition and leaves the existing review metadata unchanged.

## Technical Notes

- Existing `GET /guardians/:id/students` repository plumbing can inform `GET /guardians/me/students`, but the parent route must derive guardian identity from current user and campus.
- The existing current-user profile mapping is not sufficient for multi-campus guardian resolution because it returns one non-archived guardian/staff profile without campus-specific selection. Add a campus-aware guardian lookup instead of relying on `User.profile`.
- Parent routes should validate campus context without requiring seeded parent campus roles, then enforce D1 relationship authorization inside use cases.
- Admin routes should follow existing `CampusGuard`, `PermissionsGuard`, `StandardResponse`, use-case, repository, and Prisma patterns from current backend feature slices.
- Because generic standard filters cannot express cross-field date overlap cleanly, `overlapsDate` should be implemented as a dedicated query parameter.
- If audit logging is added for create/review, it must follow existing unit-of-work/audit conventions and include tests for exhaustive audit action coverage.

## Task Links

- @task-mh4xyc [parent-request-center-absence-requests-backend-01] Add absence request persistence — todo
- @task-e8z4wb [parent-request-center-absence-requests-backend-02] Add absence request RBAC permissions — todo
- @task-u3ftwg [parent-request-center-absence-requests-backend-03] Add current guardian student selector — todo
- @task-rl1ymr [parent-request-center-absence-requests-backend-04] Add parent absence request creation — todo
- @task-eo5y0s [parent-request-center-absence-requests-backend-05] Add parent absence request history — todo
- @task-f8oz9q [parent-request-center-absence-requests-backend-06] Add admin list and detail endpoints — todo
- @task-0gaonu [parent-request-center-absence-requests-backend-07] Add admin review workflow — todo
- @task-lz07x0 [parent-request-center-absence-requests-backend-08] Add cross-flow verification coverage — todo

## Open Questions

None currently.
