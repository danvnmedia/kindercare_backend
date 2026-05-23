---
title: Bulk Class-Staff Assignment
description: 'Backend spec for the v1 bulk class-staff endpoints: bulk-assign and eligible-staff. Closes the asymmetry where bulk-enrollment shipped for students but staff still requires N parallel single-row POSTs. Per-row roles, whole-call validation, whole-batch transaction.'
createdAt: '2026-05-23T19:19:16.484Z'
updatedAt: '2026-05-23T19:22:42.800Z'
tags:
  - spec
  - approved
  - backend
  - class-management
  - class-staff
  - bulk
---

## Overview

Adds two endpoints to class-management so the frontend can assign multiple staff to a class in one call (mirroring the bulk-enrollment wizard for students). Closes the asymmetry called out in @doc/specs/bulk-enrollment#out-of-scope ("Bulk staff assignment" was deferred there).

In scope (v1):
- `POST /classes/:id/staff/bulk` — assign N staff to one class, each row carrying its own role.
- `GET /classes/:classId/eligible-staff` — paginated list of campus staff NOT yet assigned to this class.

Foundation: @doc/specs/subject-removal-classstaff-role-refactor (ClassStaffRole enum, HOMEROOM uniqueness invariant, single-row use cases).

Pattern source: @doc/specs/bulk-enrollment (whole-call vs per-row validation, persistence shape, error-code centralization rules, eligible-X endpoint shape).

Out of scope (deferred):
- Bulk role change (`PATCH /classes/:id/staff/bulk`) — single-row `PATCH /classes/:classId/staff/:staffId` covers the wizard's current needs.
- Bulk remove (`DELETE /classes/:id/staff/bulk`) — single-row remove suffices.
- Frontend wizard implementation, hooks, services, UI.
- Modifying the single-row `AssignStaffToClassUseCase` — it stays untouched.

## Locked Decisions

- **D1**: Per-row role. Body is `{ staff: [{ staffId, role }] }` — each row carries its own `ClassStaffRole`. One call may mix HOMEROOM + ASSISTANT + BOARDING. No batch-level role field. Rationale: kindergarten classes typically need a mix of roles per real cohort (1 HOMEROOM + 1–2 ASSISTANTs ± 1 BOARDING) and forcing the FE to fire multiple single-role batches would defeat the purpose of bulk.
- **D2**: Multiple HOMEROOM rows in one payload → whole-call abort 400 `MULTIPLE_HOMEROOM_IN_BATCH`. Validated in payload BEFORE any DB work, alongside `DUPLICATE_STAFF_IN_BATCH`. Treated as a payload-shape error (FE catches it client-side anyway). Rationale: per-class HOMEROOM uniqueness is a domain invariant — a payload that violates it on its face never resolves to a useful partial result.
- **D3**: Whole-batch transaction. All post-validation survivors persist inside one `unitOfWork.run` — N `createClassStaff` writes + N `recordAudit` writes, atomically. A mid-batch DB error (concurrent unique violation) rolls back the entire batch and returns 5xx. Mirrors @doc/specs/bulk-enrollment#locked-decisions D3 / AC-8. Differs from bulk-transfer D7 (which uses per-row transactions because each transfer is a two-write atomic pair).
- **D4**: Ship `GET /classes/:classId/eligible-staff` in v1 alongside the bulk POST. New repo method `StaffRepository.findEligibleForClass(classId, params, scope)`; Prisma impl applies a `NOT EXISTS` (or anti-join) predicate on `classStaff` while still routing through `PrismaQueryService.executeQuery` for pagination, sort, and search. Mirrors @doc/specs/bulk-enrollment D2.
- **D5**: Batch ceiling = 100. Mirrors @doc/specs/bulk-enrollment NFR-1. A realistic class has 1–5 staff but the 100 ceiling provides headroom for campus-wide multi-class onboarding flows and bounds the worst-case transaction size.
- **D6**: URL shapes:
  - `POST /classes/:id/staff/bulk`
  - `GET /classes/:classId/eligible-staff`
- **D7**: Per-row tolerant result envelope: `{ assigned: ClassStaffResponse[], skipped: [{ staffId, reason, message? }] }`. Whole-call validation failures → HTTP 4xx with no row work. Per-row failures → HTTP 200 with the failing rows in `skipped[]`. Mirrors @doc/specs/bulk-enrollment D9.
- **D8**: Bulk-only error codes are **added to the existing `src/application/class-management/class-staff-error-codes.ts` module**, NOT a new bulk-specific module. Rationale: class-staff codes are already centralized — there is no inline-vs-centralized split to preserve like @doc/specs/bulk-enrollment D4 had. New additions: `BATCH_EMPTY`, `BATCH_TOO_LARGE`, `DUPLICATE_STAFF_IN_BATCH`, `MULTIPLE_HOMEROOM_IN_BATCH`, `STAFF_NOT_FOUND`, `STAFF_NOT_IN_CAMPUS`.
- **D9**: Cross-campus class lookup → `404 NotFoundException("Class with ID … not found")`. Mirrors @doc/specs/bulk-enrollment D5 (existence-hiding convention).
- **D10**: Per-row audit emission inside the whole-batch transaction. Each persisted row emits one `ASSIGN_STAFF_TO_CLASS` audit event via `tx.recordAudit` (same context shape as the single-row use case: `{ actorName, classId, role }`). All audits commit-or-roll-back together with the batch.

## Requirements

### Functional Requirements

**Bulk assign**
- **FR-1**: `POST /classes/:id/staff/bulk` accepts `{ staff: [{ staffId, role }] }` where `role ∈ { HOMEROOM, ASSISTANT, BOARDING }` and returns `{ assigned: ClassStaffResponse[], skipped: [{ staffId, reason, message? }] }`.
- **FR-2**: There is NO batch-level `role` field. Every row carries its own role. The DTO rejects requests missing per-row `role` with a standard validation 400.
- **FR-3**: Whole-call validation runs in this order, short-circuiting on first failure: (a) `BATCH_EMPTY`; (b) `BATCH_TOO_LARGE`; (c) `DUPLICATE_STAFF_IN_BATCH` (same `staffId` appears more than once); (d) `MULTIPLE_HOMEROOM_IN_BATCH` (more than one row carries `role=HOMEROOM`); (e) class exists & in campus (else 404). Any failure aborts before per-row work.
- **FR-4**: Per-row validation runs in this order: (a) `STAFF_NOT_FOUND`; (b) `STAFF_NOT_IN_CAMPUS`; (c) `STAFF_ALREADY_ASSIGNED` (a `classStaff` row already exists for `(classId, staffId)`, regardless of role); (d) `HOMEROOM_ALREADY_ASSIGNED` (only when `row.role === HOMEROOM` AND the class already has a HOMEROOM in DB). First failure pushes to `skipped[]` and continues.
- **FR-5**: All post-validation survivors persist via a single `unitOfWork.run`. Each survivor produces one `tx.createClassStaff(...)` write and one `tx.recordAudit({ action: "ASSIGN_STAFF_TO_CLASS", ... })` write. Mid-batch DB error rolls back the whole batch.

**Eligible staff**
- **FR-6**: `GET /classes/:classId/eligible-staff` accepts standard pagination (`limit`, `offset`, `sort`) plus `search?` (ilike on `fullName`).
- **FR-7**: Every returned staff satisfies all of: `staff.campusId === class.campusId`; `staff.isArchived === false`; **no** row in `classStaff` with `(classId = :classId, staffId = staff.id)`.
- **FR-8**: Cross-campus class returns 404 (D9).

**Shared**
- **FR-9**: Both endpoints use `@RequireCampusAccess()` and read campus via `@CampusContext()`. Swagger decorators (`ApiOperation`, `ApiHeader`, `ApiParam`, `ApiQuery`, `StandardResponse`) match the existing class.controller style.
- **FR-10**: Bulk endpoint emits Logger entries on entry, success-summary, and failure with `classId`, `campusId`, and counts.
- **FR-11**: `class-staff-error-codes.ts` is extended with the 6 new codes from D8. The single-row use cases are not modified — they continue to throw their existing codes.

### Non-Functional Requirements

- **NFR-1**: Batch ceiling = 100 staff per call. Exceeding → 400 `BATCH_TOO_LARGE`.
- **NFR-2**: Bulk persistence step uses one `unitOfWork.run`. Pre-validation may issue its own queries (per-row lookups); prefer `findByIds` where it reduces round trips.
- **NFR-3**: Eligible-staff endpoint MUST paginate; never returns an unbounded list.
- **NFR-4**: Both endpoints have full Swagger documentation consistent with existing class-management endpoints.

## Acceptance Criteria

### Bulk assign

- [ ] **AC-1**: `POST /classes/<id>/staff/bulk` with 4 valid rows `[{ staffId: a, role: HOMEROOM }, { staffId: b, role: ASSISTANT }, { staffId: c, role: ASSISTANT }, { staffId: d, role: BOARDING }]` returns 200 with `assigned.length === 4`, `skipped.length === 0`. DB has 4 new `classStaff` rows and 4 `ASSIGN_STAFF_TO_CLASS` audit rows.
- [ ] **AC-2**: Mixed batch — 2 valid + 1 already-assigned + 1 cross-campus staff returns 200 with `assigned.length === 2`, `skipped.length === 2` containing reasons `STAFF_ALREADY_ASSIGNED` and `STAFF_NOT_IN_CAMPUS`. The 2 assigned rows persist.
- [ ] **AC-3**: All-skipped batch (all 3 staff already-assigned) returns 200 with `assigned.length === 0`, `skipped.length === 3`. No new rows written and no audit rows emitted.
- [ ] **AC-4**: Whole-call: class doesn't exist → 404 `Class with ID … not found`. Cross-campus class → 404 (same body — existence hidden, per D9). No row work performed.
- [ ] **AC-5**: Whole-call: payload contains 2 rows with `role=HOMEROOM` → 400 `MULTIPLE_HOMEROOM_IN_BATCH`. No DB writes, no `skipped[]` (this is a 4xx, not a 200 with skips).
- [ ] **AC-6**: Whole-call limits: 101 staff → 400 `BATCH_TOO_LARGE`; 0 staff → 400 `BATCH_EMPTY`; duplicate `staffId` in payload → 400 `DUPLICATE_STAFF_IN_BATCH`.
- [ ] **AC-7**: Per-row HOMEROOM conflict — class already has a HOMEROOM in DB, batch includes one row `{ staffId: x, role: HOMEROOM }` + two ASSISTANT rows → returns 200 with `assigned.length === 2` (the two ASSISTANTs) and `skipped` containing `{ staffId: x, reason: HOMEROOM_ALREADY_ASSIGNED }`. The ASSISTANT rows persist.
- [ ] **AC-8**: Race condition — if a unique-violation fires inside the whole-batch transaction (concurrent assign occurred between validation and persistence), the entire batch rolls back. The endpoint returns 5xx (unhandled), no `classStaff` rows persist, and no `ASSIGN_STAFF_TO_CLASS` audit rows persist. Documented behavior, not a happy path.
- [ ] **AC-9**: Audit emission — each persisted row produces exactly one `ASSIGN_STAFF_TO_CLASS` audit row with `targetType="staff"`, `targetId=staffId`, `context.classId=classId`, `context.role=row.role`, `context.actorName=currentUser.profile.fullName ?? null`, `campusId=input.campusId`.

### Eligible staff

- [ ] **AC-10**: `GET /classes/<classId>/eligible-staff` returns paginated `StaffResponse`. Every returned staff is at `class.campusId`, `isArchived=false`, and has no `classStaff` row for `(classId, staff.id)`.
- [ ] **AC-11**: With `?search=Lan`, results filter by ilike on `fullName`. Pagination (`limit`, `offset`) and sort behave per `StandardRequest` semantics.
- [ ] **AC-12**: Cross-campus class → 404 (D9).
- [ ] **AC-13**: A staff already assigned to this class is excluded from results, regardless of their role on that row.

### Domain & shared

- [ ] **AC-14**: `class-staff-error-codes.ts` exports each of the 6 new codes from D8 in addition to the existing 3. Bulk use case imports from it.
- [ ] **AC-15**: `StaffRepository.findEligibleForClass(classId: string, params: StandardRequest, scope: { campusId: string }): Promise<PaginatedResult<Staff>>` exists on the port. Prisma impl applies the anti-join predicate while still using `PrismaQueryService.executeQuery` for pagination, sort, and search.
- [ ] **AC-16**: `UnitOfWorkPort.run`-compatible transaction context exposes `createClassStaff` (already in place per @doc/specs/subject-removal-classstaff-role-refactor) — no new tx ops method needed for the bulk path.

## Scenarios

### Scenario 1: Happy path — assign a full kindergarten cohort
**Given** a class `c1` in campus `cam1` with no staff yet, and four staff `s1..s4` all in `cam1`
**When** `POST /classes/c1/staff/bulk` body `{ staff: [{ staffId: s1, role: HOMEROOM }, { staffId: s2, role: ASSISTANT }, { staffId: s3, role: ASSISTANT }, { staffId: s4, role: BOARDING }] }`
**Then** response is 200 with `assigned.length === 4`, `skipped.length === 0`; DB has 4 `classStaff` rows and 4 `ASSIGN_STAFF_TO_CLASS` audit rows; the HOMEROOM partial unique index has exactly one row for `c1`.

### Scenario 2: Mixed validity
**Given** class `c1` in `cam1`, staff `s1` in `cam1`, staff `s2` already in `class_staff` for `c1`, staff `s3` in a different campus `cam2`
**When** `POST /classes/c1/staff/bulk` body `{ staff: [{ staffId: s1, role: ASSISTANT }, { staffId: s2, role: ASSISTANT }, { staffId: s3, role: ASSISTANT }] }`
**Then** response is 200; `assigned` contains the `s1` ClassStaffResponse; `skipped` contains `[{ staffId: s2, reason: "STAFF_ALREADY_ASSIGNED" }, { staffId: s3, reason: "STAFF_NOT_IN_CAMPUS" }]`; only one new `classStaff` row written.

### Scenario 3: Payload-shape rejection
**Given** any class
**When** `POST /classes/c1/staff/bulk` body `{ staff: [{ staffId: s1, role: HOMEROOM }, { staffId: s2, role: HOMEROOM }] }`
**Then** response is 400 with body `MULTIPLE_HOMEROOM_IN_BATCH`; no DB writes; no `skipped[]` field in the response.

### Scenario 4: HOMEROOM seat already taken
**Given** class `c1` already has a HOMEROOM `s_existing`; new payload contains one `{ staffId: s5, role: HOMEROOM }` + two ASSISTANT rows
**When** `POST /classes/c1/staff/bulk`
**Then** response is 200; `assigned` contains the two ASSISTANT rows; `skipped` contains `[{ staffId: s5, reason: "HOMEROOM_ALREADY_ASSIGNED" }]`; the existing `s_existing` HOMEROOM is untouched.

### Scenario 5: Eligible-staff filter feeds the wizard
**Given** class `c1` in `cam1`, campus has 30 staff total, 5 already assigned to `c1`
**When** `GET /classes/c1/eligible-staff?limit=50`
**Then** response is 200 with `data.length === 25`; none of the returned staff IDs appear in `classStaff` for `c1`; all returned staff have `campusId === cam1` and `isArchived === false`.

### Scenario 6: Race-condition rollback
**Given** class `c1` with no HOMEROOM, payload of 3 ASSISTANT rows where one of them happens to be assigned to `c1` concurrently between validation and persistence
**When** `POST /classes/c1/staff/bulk` and the concurrent insert wins by milliseconds
**Then** the transaction containing the bulk persistence catches the unique-violation, rolls back, and returns 5xx; no `classStaff` rows from this batch persist; no `ASSIGN_STAFF_TO_CLASS` audit rows from this batch persist.

## Technical Notes

- Endpoint lives in `class.controller.ts` alongside the existing single-row staff endpoints (`@Post(":id/staff")`, `@Get(":id/staff")`, `@Delete(":classId/staff/:staffId")`, `@Patch(":classId/staff/:staffId")`).
- Use case lives at `src/application/class-management/use-cases/class-staff/bulk-assign-staff-to-class.use-case.ts`. Mirror the file/class naming of `bulk-enroll-students.use-case.ts`.
- DTOs in `src/infra/http/dtos/class-management/`: `BulkAssignStaffRequest`, `BulkAssignStaffResponse`, plus a `BulkAssignStaffSkippedItem` shape. Reuse the existing `ClassStaffResponse` for `assigned[]`.
- Eligible-staff DTO: reuse the existing `StaffResponse`.
- Repo port additions:
  - `StaffRepository.findEligibleForClass(classId, params, scope: { campusId })` — Prisma impl uses an anti-join (`NOT EXISTS` against `classStaff`).
  - `ClassStaffRepository` already has `findByPair` and `findHomeroomByClassId` from the single-row use case — bulk reuses them. Consider whether `findByPairs(classId, staffIds[])` is worth adding to collapse N lookups; if added, it's an NFR-2 win, not a correctness requirement.
- Audit emission follows the same `tx.recordAudit({ action, targetType, targetId, campusId, context })` shape as `assign-staff-to-class.use-case.ts`. The `context.actorName` uses `currentUser.profile?.fullName ?? null` to match.
- See @doc/specs/admin-audit-log FR-3 for actor plumbing; the controller already passes `@CurrentUser()` to single-row staff endpoints — bulk mirrors that.
- See memory `xo1byz` (UoW convention): any mutation emitting audit must go through `unitOfWork.run` — D3 satisfies this.

## Open Questions

- [ ] Do we need a `force` / `overwrite` flag that turns `STAFF_ALREADY_ASSIGNED` into "update role on existing row"? Current answer: **no** — that is what `PATCH /classes/:classId/staff/:staffId` is for. Surface only if FE pushes back.
- [ ] Should `MULTIPLE_HOMEROOM_IN_BATCH` also be caught by the DTO layer with a custom class-validator decorator, so it returns the same 400 without entering the use case? Could go either way; defer until implementation reveals a preference.
