---
title: Health Center Backend Research
description: Backend research and spec-shaping notes for Health Center daily operations based on the frontend handoff and current Student Health V1 implementation.
createdAt: '2026-07-01T04:08:43.162Z'
updatedAt: '2026-07-10T22:05:04.808Z'
tags:
  - research
  - health-center
  - student-health
  - backend-spec
  - frontend
  - archived
---

# Health Center Backend Research

## Purpose

Prepare backend spec input for the staff-facing `Health Center` daily operations page.

Primary frontend source lives in the frontend workspace, not this backend Knowns index:

- Frontend workspace doc: `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/.knowns/docs/backend-handoff/health-center-backend-handoff.md`
- Frontend spec: `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/.knowns/docs/specs/2026-07-01/health-center.md`

Related backend/student-health context:

- @doc/specs/2026-07-01/student-profile-health-tab-backend
- @doc/archive/research/student-profile-health-tab-fullstack-research
- @doc/archive/research/student-health-management-backend-research

## Frontend Need

Health Center V1 is a read-only staff-facing page for daily student health operations across the active campus.

It must show:

- active health instructions for a selected date
- open health events as of a selected date
- optional class filtering
- student summary per item
- class summary per item when available
- enough detail fields or IDs for a modal
- navigation target to the student's existing Health tab

Frontend decisions already locked in the frontend spec:

- Page name is `Health Center`.
- Active campus is the default scope.
- V1 supports selected date and optional class filter.
- Main list includes active medical instructions and open health events only.
- Latest checkups are not part of Health Center V1.
- V1 is read-only: no create, update, resolve, mark-done, or medication administration logging.
- Access uses active campus access plus `student_health.read`; no new `health_center.read` permission is requested.
- Open events should include earlier events that remain open.

## Current Backend Reality

Student Health V1 is implemented, but it is mostly student-scoped.

Implemented and reusable:

- `src/infra/http/modules/student-health.module.ts`: existing Student Health module, controllers, use cases, repository providers, guards, campus context.
- `src/infra/http/controllers/student-health.controller.ts`: student-scoped health profile, checkups, instructions, active student instructions, and health events.
- `src/infra/http/controllers/class-health-instructions.controller.ts`: `GET /api/classes/:classId/health-instructions/active`.
- `src/application/student-health/use-cases/*`: profile/checkup/instruction/event use cases.
- `src/infra/persistence/prisma/repositories/prisma-student-health-instruction.repository.ts`: has active instruction methods for one student and for a supplied student-id list.
- `src/infra/persistence/prisma/repositories/prisma-student-health-event.repository.ts`: has student-scoped event list/detail/create/update only.
- `prisma/schema.prisma`: health profile/checkup/instruction/event models and enums.
- `src/application/rbac/use-cases/seed-permissions.use-case.ts`: seeds `student_health.read`, `student_health.create`, and `student_health.update`.

Current endpoint surface:

- `GET /api/students/:studentId/health-profile`
- `PATCH /api/students/:studentId/health-profile`
- `GET /api/students/:studentId/health-checkups`
- `POST /api/students/:studentId/health-checkups`
- `GET /api/students/:studentId/health-checkups/:checkupId`
- `PATCH /api/students/:studentId/health-checkups/:checkupId`
- `GET /api/students/:studentId/health-instructions`
- `POST /api/students/:studentId/health-instructions`
- `GET /api/students/:studentId/health-instructions/active`
- `GET /api/students/:studentId/health-instructions/:instructionId`
- `PATCH /api/students/:studentId/health-instructions/:instructionId`
- `GET /api/classes/:classId/health-instructions/active`
- `GET /api/students/:studentId/health-events`
- `POST /api/students/:studentId/health-events`
- `GET /api/students/:studentId/health-events/:eventId`
- `PATCH /api/students/:studentId/health-events/:eventId`

All existing health endpoints use the standard conventions:

- Clerk authentication
- `X-Campus-Id` active campus context
- `@RequireCampusAccess()`
- `PermissionsGuard`
- `student_health.read/create/update`
- standard response envelope
- standard list pagination where list resources are used

## Current Frontend Reality

Student Profile Health tab exists and uses the implemented Student Health V1 endpoints.

Relevant frontend files:

- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/services/student-health.service.ts`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/hooks/use-student-health-profile.ts`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/hooks/use-student-health-checkups.ts`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/hooks/use-active-student-health-instructions.ts`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/hooks/use-student-health-instructions.ts`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/hooks/use-student-health-events.ts`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/types.ts`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/components/profile/health-tab.tsx`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/components/profile/health-snapshot-panel.tsx`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/components/profile/health-records-panel.tsx`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/features/students/components/profile/health-record-detail-dialog.tsx`
- `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/app/dashboard/(people)/students/[studentId]/page.tsx`

No Health Center page, service, hook, or route exists in frontend source yet. Source search found only Student Profile Health usage. The Health Center docs/spec exist, but implementation is still pending.

The frontend API client already injects auth and `X-Campus-Id` through `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/lib/api-client.ts` and unwraps standard backend envelopes typed in `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend/src/lib/api/types.ts`.

## Backend Gaps For Health Center

### 1. No campus-wide Health Center read endpoint

Existing endpoints require a known student or class. Health Center needs active-campus daily data without frontend iterating all students/classes.

Recommended spec target:

- `GET /api/health-center/daily-items`

Alternative route shapes are possible, but a single read endpoint is the lowest-friction frontend contract and avoids N+1 calls.

### 2. Campus-wide active instruction query is missing

Reusable existing logic:

- `findActiveByStudentInCampus(campusId, studentId, referenceDate)`
- `findActiveByStudentsInCampus(campusId, studentIds, referenceDate)`
- `GetActiveClassHealthInstructionsUseCase` validates class campus and uses historical enrollments active on the selected date.

Missing for Health Center:

- a campus-wide selected-date student/enrollment source
- or a direct campus-wide active instruction repository method that returns instruction rows joined with student and class summary

Class filter should reuse the existing selected-date historical enrollment semantics from `GetActiveClassHealthInstructionsUseCase`, because that implementation intentionally handles closed enrollments active on the requested date.

### 3. Campus-wide open event query is missing

Current event repository only supports:

- student-scoped list
- student-scoped detail
- create/update

Health Center needs campus-wide `OPEN` events with optional class filter and student/class summary.

Recommended backend addition:

- repository/use-case support for open events in campus, filtered by selected date and optional class membership

Important semantic gap:

- `StudentHealthEvent` stores current `status` and `occurredAt`, but no status history.
- Therefore `OPEN as of selected date` cannot be reconstructed historically after an event is resolved.
- For V1, the backend spec should explicitly define this as current `status = OPEN` and `occurredAt <= end of selected date`, unless product requires status-history tracking as a separate feature.

### 4. Student and class summary enrichment is needed

Health Center rows need student and class display fields.

Student fields likely needed:

- `id`
- `fullName`
- `studentCode`
- optional `nickname` if already safe/exposed

Class fields likely needed:

- `id`
- `name`

The current active class instruction endpoint returns student summary but not class summary per item because class is implicit. Health Center aggregate should include class summary when available.

### 5. Detail modal contract must be decided

Frontend handoff allows two options:

- aggregate response contains enough detail for the modal
- aggregate response returns IDs and frontend fetches existing student-scoped detail endpoints

Recommended for V1:

- include enough detail for modal display in the aggregate response to avoid immediate follow-up requests
- still include `studentId`, `instructionId` or `eventId`, and `studentProfileHealthUrl`-derivable IDs so frontend can navigate or refetch if needed

### 6. Pagination/sorting needs explicit decision

The frontend can accept backend-owned default ordering. Suggested default:

- instructions ordered by next operational time/date/title/student
- events ordered by `occurredAt desc` or grouped after instructions

If results may be large, return standard pagination metadata. If V1 caps the result, document the cap and counts.

### 7. Read privacy/audit behavior is open

Existing student-health mutations audit create/update actions. Existing read endpoints do not appear to emit audit rows. Health Center is a campus-wide health data read surface, so the backend spec should explicitly decide whether read access is only authorization-gated or also audit-logged.

### 8. Default role assignment remains open

The permission catalog seeds `student_health.*`, but the backend Student Profile Health spec left default role assignment open. Health Center V1 depends on frontend/dev/staging accounts having `student_health.read`.

## Suggested Backend Spec Scope

Create a backend spec for a read-only Health Center aggregate API.

Recommended scope:

- Add one campus-scoped read endpoint for Health Center daily items.
- Support `date` as optional `YYYY-MM-DD`, defaulting to server current date if omitted.
- Support optional `classId` filter.
- Return active health instructions for the selected date.
- Return open health events using explicit V1 semantics.
- Include student/class summary fields.
- Include enough fields for the detail modal and navigation to Student Profile Health tab.
- Require `student_health.read` only.
- Use existing standard response/error conventions.
- Add focused backend tests for campus access, permission gating, class filtering, selected-date semantics, open events from earlier dates, empty state, invalid date, and class-not-found.

Recommended out of scope:

- new `health_center.read` permission
- writes or resolution actions
- medication administration logging
- latest checkups in Health Center main list
- parent requests, documents, attachments, intake links
- historical event status reconstruction after resolution
- class-only teacher visibility beyond existing `student_health.read` semantics

## Spec Gray Areas To Lock

D1. Route shape and ownership:

- Recommended: `GET /api/health-center/daily-items`
- Alternative: `GET /api/student-health/daily-items`

D2. Response organization:

- grouped `{ instructions: [], events: [], counts }`
- or unified `items[]` with `itemType`

D3. Open event semantics:

- Recommended V1: current `status = OPEN` and `occurredAt <= selected day end`
- Alternative: introduce status history, which is a larger feature

D4. Class membership semantics:

- Recommended: selected-date historical enrollment semantics, matching existing class active-instructions endpoint
- Alternative: current class only

D5. Detail strategy:

- Recommended: aggregate includes full modal fields
- Alternative: aggregate summary plus frontend follow-up detail fetches

D6. Result size behavior:

- standard pagination
- or documented capped unpaginated arrays with counts

D7. Read audit/privacy:

- authorization only
- or audit Health Center reads as a privacy-sensitive aggregate view

## Recommended Acceptance Criteria For Backend Spec

- A permitted staff user can call the endpoint with active campus context and receive a stable success shape.
- A user without `student_health.read` receives 403 and no health values.
- Missing or invalid campus context follows existing campus error behavior.
- Invalid `date` returns a 400-style validation error.
- Unknown or cross-campus `classId` returns 404 or 403 consistent with existing class campus behavior.
- Without `classId`, response includes active instructions across the selected campus/date.
- With `classId`, response narrows instructions to students enrolled in that class on the selected date.
- Response includes current-open events that occurred on or before the selected day.
- Open events from earlier dates remain visible while current status is `OPEN`.
- Resolved or archived events are excluded.
- Empty result sets return success with empty arrays/counts.
- Items include IDs, student summary, class summary when available, type/status labels, and modal detail fields.
- No writes, event resolution, mark-done, or medication administration actions are introduced.
- Existing Student Profile Health endpoints continue to work unchanged.

## Recommended Implementation Anchors

- Extend `StudentHealthModule` with a Health Center read use case and controller unless backend ownership prefers a separate module.
- Reuse `parseReferenceDate` and `normalizeReferenceDate` for date handling.
- Reuse `StudentHealthInstructionStatus.ACTIVE` status logic.
- Reuse class selected-date enrollment semantics from `GetActiveClassHealthInstructionsUseCase`.
- Extend repository ports rather than querying Prisma directly from controllers.
- Add response DTOs under `src/infra/http/dtos/student-health` or a new health-center DTO folder.
- Add controller metadata tests similar to `student-health.controller.spec.ts`.
- Add focused use-case/repository tests for the aggregate behavior.

## Research Checklist

- [x] Checked backend Knowns docs and related tasks.
- [x] Resolved related Student Health backend spec and completed tasks.
- [x] Inspected existing backend Student Health controllers, DTOs, use cases, repositories, Prisma schema, and permission seeding.
- [x] Inspected frontend Health Center handoff/spec in the frontend workspace.
- [x] Inspected frontend Student Profile Health services/hooks/components and confirmed no Health Center source implementation exists yet.
- [x] Identified reusable backend components and missing backend aggregate capability.
