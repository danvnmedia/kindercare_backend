---
title: Parent Request Center Absence Requests Backend Research
description: Backend research and spec-shaping notes for Parent Request Center Absence Requests based on the frontend handoff and existing backend architecture.
createdAt: '2026-06-26T15:47:07.258Z'
updatedAt: '2026-07-10T22:05:07.479Z'
tags:
  - research
  - parent-request-center
  - absence-requests
  - backend-spec
  - archived
---

# Parent Request Center Absence Requests Backend Research

## Purpose

Prepare backend spec input for @doc/archive/frontend-handoff/parent-request-center-absence-requests-frontend-handoff.

The frontend wants Parent Request Center v1 with Absence Requests as the only active workflow. Parents/guardians submit absence requests for linked children in the current campus; admins list, filter, approve, or deny those requests. Medical Instructions are out of scope except for a disabled/coming-later frontend state.

## Current Backend Reality

### No absence-request implementation exists

A direct source/schema search found no absence-request domain, controller, Prisma model, repository, or use case. Existing hits for `absence` are only incidental comments and the frontend handoff doc. This should be a new backend vertical slice.

### Guardian child data exists, but not as a current-parent endpoint

Current implementation:

- `src/infra/http/controllers/user-management/guardian.controller.ts:369` exposes `GET /guardians/:id/students`.
- `src/application/user-management/use-cases/guardian/get-guardian-children.use-case.ts:14` accepts a `guardianId` and optional `campusId`, validates the guardian's campus, then calls the repository.
- `src/infra/persistence/prisma/repositories/prisma-guardian.repository.ts:222` queries `guardianStudent` by `guardianId` and includes `student` plus `guardianRelationship`.
- `src/infra/http/dtos/user-management/guardian/guardian-child.response.ts` already contains a useful child selector response shape: `student.id`, `student.fullName`, `student.studentCode`, and relationship details.

Gap: the frontend needs children for the current authenticated guardian in the selected campus. The current endpoint is admin-style because it takes `:guardianId` from the URL. The spec should add a current-parent endpoint or route behavior that derives the guardian from the authenticated user and campus rather than accepting a guardian ID from the parent client.

### Current user profile is not enough for multi-campus guardian resolution

`/auth/me` returns a `User` from `RequestContext.getUserOrFail()`, and `PrismaUserRepository` includes one non-archived guardian and one non-archived staff profile (`src/infra/persistence/prisma/repositories/prisma-user.repository.ts:18`, `:31`, `:33`, `:37`). `PrismaUserMapper` prefers staff over guardian and maps the first guardian if no staff profile exists (`src/infra/persistence/prisma/mapper/prisma-user.mapper.ts:94`).

Because the include is not campus-scoped, absence-request use cases should resolve the guardian by `currentUser.id` + `campusId`, not rely solely on `currentUser.profile.id`. `GuardianRepository.findByUserId()` exists (`src/application/user-management/ports/guardian.repository.ts:46`, implemented at `src/infra/persistence/prisma/repositories/prisma-guardian.repository.ts:112`), but it is currently not campus-scoped and may need a `findByUserIdInCampus(campusId, userId)` variant.

### CampusGuard is role-based, not guardian-profile based

`CampusGuard` defaults `checkUserAccess = true` and calls `hasCampusAccess` (`src/infra/http/guards/campus.guard.ts:70`, `:113`, `:139`). `hasCampusAccess` grants access when the user has at least one role for the campus (`src/infra/http/context/campus-context.ts:58`, `:65`).

This is fine for admin endpoints, but parent endpoints may need a deliberate model:

- grant guardian users a campus role, or
- use `@RequireCampusAccess({ checkUserAccess: false })` only to validate the campus, then authorize in the use case by resolving guardian-by-user-and-campus and checking the guardian-student relationship.

The spec should not assume parent users pass `CampusGuard` role checks unless product/backend confirms parent role seeding.

### Relevant schema foundations

- `Campus` exists but has no timezone field (`prisma/schema.prisma:16`).
- `Student` is campus-scoped and has `studentCode`, `fullName`, `isArchived`, and `campusId` (`prisma/schema.prisma:309`).
- `Guardian` is campus-scoped and links to `User` by `userId` (`prisma/schema.prisma:419`).
- `GuardianStudent` is the guardian-child join table with composite primary key `[studentId, guardianId]` (`prisma/schema.prisma:459`).
- `StudentAttendanceSummary` is separate attendance master data with one row per student/date (`prisma/schema.prisma:666`).
- `PostApprovalRequest` is an approval-request precedent with status, reviewer, review timestamp, and review note (`prisma/schema.prisma:942`).
- `WeeklyPlan` is a recent vertical-slice precedent for a new campus-scoped feature (`prisma/schema.prisma:1060`).

### Attendance should remain separate in v1

Attendance has statuses including `ABSENT` and `EXCUSED` (`src/domain/attendance/enums/attendance-status.enum.ts:5`, `:9`, `:13`) and endpoints under `src/infra/http/controllers/attendance.controller.ts:42`, all campus-guarded (`:56`, `:89`, `:129`, `:159`, `:196`, `:237`).

However, the frontend handoff explicitly says approval must not create or update attendance records in v1. The backend spec should make this an acceptance criterion and keep absence requests in a new table/workflow rather than reusing attendance mutations.

### Approval workflow precedent is useful, but not directly reusable

`PostApprovalRequest` has pending/approved/rejected state and review metadata (`src/domain/content-management/entities/post-approval-request.entity.ts:98`, `:118`). `PrismaPostApprovalRequestRepository.findPendingByCampus()` shows a paginated approval list precedent (`src/infra/persistence/prisma/repositories/prisma-post-approval-request.repository.ts:67`).

But content management authorization is historical: approve/reject use cases call `currentUser.hasSystemRole()` (`src/application/content-management/use-cases/approve-post.use-case.ts:52`, `src/application/content-management/use-cases/reject-post.use-case.ts:53`), and rejection requires a comment (`src/application/content-management/use-cases/reject-post.use-case.ts:60`). Absence v1 should use newer permission-guard routing and should allow denial without a reason per frontend AC.

### New-feature route and repository conventions

Weekly Plan is the best current precedent:

- Controller routes use `@RequireCampusAccess()`, `PermissionsGuard`, and explicit permissions such as `weekly_plan.list/read/create/update/delete` (`src/infra/http/controllers/weekly-plan.controller.ts:100`, `:102`, `:131`, `:133`, `:212`, `:214`).
- Standard paginated list responses declare allowed sort/filter fields (`src/infra/http/controllers/weekly-plan.controller.ts:103`, `:107`, `:108`).
- Campus is documented as system-enforced, not a user filter (`src/infra/http/controllers/weekly-plan.controller.ts:121`).
- The repository applies trusted `scope` last and excludes archived rows by default unless `isArchived` is explicitly filtered (`src/infra/persistence/prisma/repositories/prisma-weekly-plan.repository.ts:55`, `:58`, `:69`).
- `GetWeeklyPlansUseCase` detects `isArchived` filters before deciding include-archived behavior (`src/application/weekly-plan/use-cases/get-weekly-plans.use-case.ts:21`, `:25`).
- Mutations use `UnitOfWorkPort` when audit rows are emitted (`src/application/ports/unit-of-work.port.ts:278`, `:304`; `src/infra/persistence/prisma/unit-of-work/prisma-unit-of-work.ts:102`, `:115`).

### Pagination and overlap filtering

Standard list endpoints use `limit`, `offset`, `sort`, and JSON `filter`. The query service builds flat per-field conditions and applies `options.scope` last (`src/core/modules/standard-response/services/prisma-query.service.ts:13`, `:128`, `:214`, `:231`, `:287`).

Absence-period overlap is a cross-field predicate: `startDate <= targetDate AND endDate >= targetDate`. It should be a dedicated query option such as `overlapsDate` or `date`, not a standard filter field pretending to fit the generic grammar.

## Recommended Backend Spec Shape

### Domain and naming

Use a new vertical slice named `absence-request` with route `absence-requests`.

Recommended permission module: `absence_request`. Live RBAC valid modules currently include `weekly_plan` but not absence requests (`src/domain/rbac/entities/permission.entity.ts:33`, `:52`). The spec should add:

- `absence_request.list`
- `absence_request.read`
- `absence_request.create`
- `absence_request.update` or a narrower review permission if the RBAC model is expanded

Because valid permission actions are fixed to create/read/update/delete/list/manage/assign/export/import, use `absence_request.update` for approve/deny unless the spec chooses `absence_request.manage` for review.

### Persistence model

Recommended Prisma model: `AbsenceRequest` mapped to `absence_request`.

Suggested fields:

- `id UUID`
- `campusId UUID`, relation to `Campus`, `onDelete: Restrict`
- `studentId UUID`, relation to `Student`, `onDelete: Restrict`
- `requesterGuardianId UUID`, relation to `Guardian`, `onDelete: Restrict`
- `requesterUserId UUID?`, relation to `User`, `onDelete: SetNull` if audit/display needs auth identity separately from guardian profile
- `absenceType String`, values `FULL_DAY | PARTIAL_DAY`
- `startDate DateTime @db.Date`
- `endDate DateTime @db.Date`
- `startMinute Int?` and `endMinute Int?` for partial-day time-of-day, following the Weekly Plan `HH:mm` API / minutes storage precedent
- `description String @db.Text` or bounded `@db.VarChar(n)` after product locks max length
- `status String @default("PENDING")`, values `PENDING | APPROVED | DENIED`
- `reviewedById UUID?`, relation to `User`, `onDelete: SetNull`
- `reviewedAt DateTime? @db.Timestamptz(6)`
- `reviewNote String? @db.Text`
- `createdAt`, `updatedAt`

Recommended indexes:

- `[campusId, status]`
- `[campusId, startDate, endDate]` for overlap queries
- `[campusId, createdAt]` for newest-first list
- `[requesterGuardianId, createdAt]` for parent list
- `[studentId, startDate, endDate]` if duplicate/overlap checks are in scope

Do not add a uniqueness constraint for overlapping requests unless product decides duplicates should be rejected. If duplicates are rejected, use an application-level overlap check; PostgreSQL exclusion constraints would be stronger but are not currently used elsewhere in this repo.

### Date and time representation

Use date-only columns for absence dates. For partial-day time-of-day, prefer `startMinute`/`endMinute` internally with `HH:mm` API fields, matching Weekly Plan's time-of-day approach.

Campus has no timezone column. Therefore the spec must lock how the default admin “today” view is calculated. Recommended v1 approach: frontend sends a date-only `overlapsDate=YYYY-MM-DD` (or backend uses an explicit server UTC date only if product accepts that). Avoid implying campus timezone support until Campus stores timezone.

### API shape

Recommended endpoints:

- `GET /guardians/me/students` or `GET /guardian/children`: current authenticated guardian child selector, campus-aware, derives guardian from current user and campus.
- `POST /absence-requests`: guardian creates a `PENDING` request for a linked child.
- `GET /absence-requests/mine`: current guardian lists own requests, newest submitted first, paginated if using standard list response.
- `GET /absence-requests`: admin campus-scoped list, paginated, filterable by `status`, sortable by `createdAt`, and with a dedicated `overlapsDate`/`date` query for absence-period overlap.
- `GET /absence-requests/:id`: useful for detail display if list response does not include all fields.
- `PATCH /absence-requests/:id/review`: admin approves or denies a pending request and returns updated state.

For parent-facing endpoints, do not accept `guardianId` from the body or query. Resolve it from current user + campus.

### Validation rules

Backend should enforce:

- Campus comes from validated request context, not request body.
- Current user must resolve to an active guardian in the selected campus for parent endpoints.
- Selected student must belong to the selected campus and be linked to the current guardian.
- Description is required and trimmed; max length should be specified.
- `absenceType` is required.
- Full-day requests require `startDate` and `endDate`; `endDate >= startDate`; time fields must be absent or ignored consistently.
- Partial-day requests require one date (`startDate == endDate`), `startTime`, `endTime`, and `endTime > startTime`.
- New requests start `PENDING`.
- Only `PENDING` can transition to `APPROVED` or `DENIED`.
- `APPROVED` and `DENIED` are terminal in v1.
- Denial review note is optional in v1.
- Review must not create/update attendance records.

Open product decisions to lock in spec:

- Whether past dates are allowed.
- Whether overlapping duplicate pending requests for the same student are allowed.
- Maximum date range length.
- Maximum description/review note length.
- Whether `reviewNote` is visible to parents or admin-only.
- Whether parent campus access is role-seeded or profile/relationship authorized.

### Tests to require

Minimum backend tests:

- Domain/entity tests for date/time/status invariants.
- Use-case tests for guardian resolution, linked-student authorization, campus mismatch rejection, full-day and partial-day creation, invalid partial-day times, terminal review states, optional denial note, and no attendance repository calls.
- Repository tests for campus scoping and overlap-date list query.
- Controller/DTO tests for route payload validation and standard response/pagination wiring.
- RBAC seed tests for new permission module and seeded permissions.
- If audit is in scope, audit enum/action-visibility/unit-of-work atomicity tests, because audit action coverage is exhaustive.

## Spec Warnings

- Existing `GET /guardians/:id/students` is reusable backend plumbing but should not be exposed to parents as-is.
- Current `User.profile` is not safely campus-specific for multi-campus parent flows.
- `CampusGuard` role-access semantics may block parent users unless parent roles are seeded or parent endpoints authorize via guardian profile after validating campus.
- Standard filter grammar cannot express absence-period overlap cleanly; add a dedicated list query field.
- Campus timezone is not modeled today, so “today” semantics need an explicit v1 decision.
- Approval/rejection should be modeled separately from attendance to satisfy the handoff's v1 no-attendance-mutation requirement.
