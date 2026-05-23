---
title: 'Subject Removal & ClassStaff Role Refactor'
description: Backend refactor removing the Subject domain (table, entity, port, mapper, repo, use case, reference-data endpoint) and reshaping ClassStaff for kindergarten-appropriate role tracking. Replaces the (classId, staffId, subjectId) composite PK with (classId, staffId) + a ClassStaffRole enum (HOMEROOM / ASSISTANT / BOARDING), enforces single-homeroom-per-class, and adds a role-change endpoint. Audit log wired for all 3 staff actions. Pre-launch — no production data migration required.
createdAt: '2026-05-23T01:04:21.057Z'
updatedAt: '2026-05-23T02:51:32.193Z'
tags:
  - spec
  - approved
  - backend
  - class-management
  - schema-change
  - removal
---

## Overview

Removes the half-built `Subject` domain from the backend and reshapes `ClassStaff` to match how Vietnamese kindergarten staff are actually organized — by role (homeroom / assistant / day-boarding), not by subject taught.

The current schema treats subject as a required dimension of every staff-class assignment (`PK = (classId, staffId, subjectId)`), which forces every assignment to claim a subject even though no feature consumes the field and the model doesn't match preschool reality (no scheduled per-subject periods, no per-subject staff rotation, no curriculum-level subject consumers in the current roadmap window).

This spec drops `Subject` entirely (table, entity, port, Prisma impl, mapper, `GetAllSubjectsUseCase`, reference-data endpoint), reshapes `ClassStaff` PK to `(classId, staffId)`, and adds a `ClassStaffRole` enum sized to the dominant Vietnamese kindergarten role taxonomy. When curriculum features eventually ship (lesson plan, daily report, observation/portfolio, report card), subject conceptually returns — but as a *curriculum-domain tag* on lessons/observations, not as a staffing axis. That return path is recorded in the decision doc, not built now.

Builds on: [[admin-audit-log]] (audit context extension), [[unit-of-work-pattern]] (mutation orchestration), [[mapper-pattern]] (Prisma↔domain conversion), [[entity-pattern]].

## Locked Decisions

- **D1**: Drop `Subject` entirely — table, entity, repository port, Prisma mapper, Prisma repository, `GetAllSubjectsUseCase`, and `GET /reference-data/subjects` endpoint. No half-state preserved.
- **D2**: `ClassStaff` PK changes from `(classId, staffId, subjectId)` → `(classId, staffId)`. One staff member holds one role per class.
- **D3**: New `ClassStaffRole` enum with three values: `HOMEROOM`, `ASSISTANT`, `BOARDING`. Stored as Prisma enum; exposed as domain-layer type.
- **D4**: V1 role scope:
  - `SPECIALIST` (giáo viên năng khiếu — music, English, art) folded into `ASSISTANT`. Promote to its own enum value the day a customer asks to filter by specialty.
  - `CARETAKER` (bảo mẫu — non-teaching hygiene/feeding) deferred. Name `CARETAKER` is **reserved** for this future role; do **not** use it for bán trú.
- **D5**: `HOMEROOM` is exactly one per class — enforced at two layers:
  - **Domain**: `AssignStaffToClassUseCase` and `ChangeClassStaffRoleUseCase` reject HOMEROOM assignment when another HOMEROOM already exists on the class → `409 Conflict` with descriptive error code.
  - **DB**: raw-SQL partial unique index — `CREATE UNIQUE INDEX class_staff_homeroom_unique ON class_staff(class_id) WHERE role = 'HOMEROOM'`. Prisma can't model partial uniques in schema declaration; use a raw migration step.
- **D6**: API breaking changes are hard-cut (no deprecation window). Frontend team coordinates a synchronized release.
- **D7**: I18n — DB stores English enum values; UI renders per locale.
  - `HOMEROOM` → "Giáo viên chủ nhiệm" (vi) / "Homeroom teacher" (en)
  - `ASSISTANT` → "Giáo viên phụ" (vi) / "Assistant teacher" (en)
  - `BOARDING` → "Giáo viên bán trú" (vi) / "Day-boarding teacher" (en)
- **D8**: Pre-launch — no production data. Migration drops `subject` table and `subjectId` column without preservation logic. Existing dev `ClassStaff` rows backfill to `ASSISTANT` (safe default; dev users can manually upgrade some rows to HOMEROOM if needed).
- **D9**: Add `PATCH /classes/:classId/staff/:staffId` for role changes. Avoids the audit gap from delete+create and matches the FE "change role" UX.
- **D10**: All three staff mutation actions (assign, remove, change-role) emit audit events with role in context (and previous role for change-role). The audit-event-context-shapes reference doc (@doc/references/audit-event-context-shapes) is updated with new shapes.
- **D11**: Decision rationale recorded at @doc/decisions/subject-removal — new `decisions/` folder (first ADR-style entry). Captures *why removed*, *when subject conceptually returns* (curriculum-domain tag on lessons/observations/report cards), and *what enum values are deferred* (SPECIALIST, CARETAKER).
## Requirements

### Functional Requirements

- **FR-1**: Remove all `Subject` code paths:
  - `src/domain/class-management/entities/subject.entity.ts`
  - `src/application/class-management/ports/subject.repository.ts`
  - `src/application/class-management/use-cases/reference-data/get-all-subjects.use-case.ts`
  - `src/infra/persistence/prisma/mapper/prisma-subject.mapper.ts`
  - `src/infra/persistence/prisma/repositories/prisma-subject.repository.ts`
  - Subject DI registration / module wiring
  - `GET /reference-data/subjects` controller route + `SubjectResponse` DTO
  - Subject injection in `AssignStaffToClassUseCase` and `RemoveStaffFromClassUseCase`

- **FR-2**: Schema changes (single Prisma migration):
  - Drop `subject` table (cascading via existing FK)
  - Drop `subjectId` column + FK from `class_staff`
  - Change `class_staff` PK from `(classId, staffId, subjectId)` to `(classId, staffId)`
  - Add `role` column of type `ClassStaffRole` (Prisma enum), required, default `ASSISTANT` for backfill, then remove default in a follow-up migration step
  - Add partial unique index via raw SQL: `CREATE UNIQUE INDEX class_staff_homeroom_unique ON class_staff(class_id) WHERE role = 'HOMEROOM'`
  - Drop indexes `@@index([subjectId])` and the FK-related indexes

- **FR-3**: Define `ClassStaffRole` enum in Prisma schema:
  ```prisma
  enum ClassStaffRole {
    HOMEROOM
    ASSISTANT
    BOARDING
  }
  ```
  Surface as a domain-layer type (`src/domain/class-management/value-objects/class-staff-role.ts` or similar — TBD by planner).

- **FR-4**: `AssignStaffToClassUseCase` contract changes:
  - Input: `{ campusId, classId, staffId, role: ClassStaffRole }` (no more subjectId)
  - Validates class, staff exist + same campus (existing behavior)
  - Rejects assignment of `HOMEROOM` if a HOMEROOM already exists for the class → `409 Conflict` with error code `HOMEROOM_ALREADY_ASSIGNED`
  - Rejects duplicate `(classId, staffId)` regardless of role → `409 Conflict` with `STAFF_ALREADY_ASSIGNED`
  - Goes through `unitOfWork.run` (project convention)
  - Emits audit event with role in context

- **FR-5**: `RemoveStaffFromClassUseCase` contract changes:
  - Input: `{ campusId, classId, staffId }` (no more subjectId)
  - Validates assignment exists; 404 if not
  - Goes through `unitOfWork.run`
  - Emits audit event with role in context (read role from existing row before deletion)

- **FR-6**: New `ChangeClassStaffRoleUseCase`:
  - Input: `{ campusId, classId, staffId, newRole: ClassStaffRole }`
  - Validates assignment exists; 404 if not
  - If `newRole` equals existing role, returns existing row unchanged (no audit event, no DB write)
  - Rejects change to `HOMEROOM` if another HOMEROOM exists for the class → `409 HOMEROOM_ALREADY_ASSIGNED`
  - Goes through `unitOfWork.run`
  - Emits audit event with `previousRole` and `newRole` in context

- **FR-7**: HTTP endpoint surface (campus-scoped via existing `@CampusContext()` decorator):
  - `POST /classes/:id/staff`
    - Body: `{ staffId: string, role: 'HOMEROOM' | 'ASSISTANT' | 'BOARDING' }`
    - 201 + `ClassStaffResponse` on success
    - 409 on HOMEROOM/staff conflict; 404 on class/staff not found; 400 on campus mismatch
  - `DELETE /classes/:classId/staff/:staffId`
    - 204 on success; 404 if assignment doesn't exist
  - `PATCH /classes/:classId/staff/:staffId` (NEW)
    - Body: `{ role: 'HOMEROOM' | 'ASSISTANT' | 'BOARDING' }`
    - 200 + updated `ClassStaffResponse` on success
    - 409 on HOMEROOM conflict; 404 if assignment doesn't exist
  - `GET /reference-data/subjects` — removed

- **FR-8**: Update `ClassStaffResponse` DTO:
  - Drop `subjectId` field
  - Add `role: ClassStaffRole` field
  - Update Swagger annotations

- **FR-9**: Audit log integration — extend the audit-event-context-shapes reference (@doc/references/audit-event-context-shapes) with:
  - `staff.assigned_to_class`: `{ classId, staffId, role }`
  - `staff.removed_from_class`: `{ classId, staffId, role }` (role read before deletion)
  - `staff.role_changed` (new action): `{ classId, staffId, previousRole, newRole }`

- **FR-10**: Domain entity `ClassStaff`:
  - Drop `subjectId` prop
  - Add `role` prop with getter
  - Factory `ClassStaff.create({ classId, staffId, role })` updated
  - Add `changeRole(newRole)` returning new immutable instance (matches existing pattern from [[entity-pattern]])

- **FR-11**: Repository port `ClassStaffRepository`:
  - Drop `findByCompositeKey(classId, staffId, subjectId)` → replace with `findByPair(classId, staffId)`
  - Drop `findBySubjectId`, `findByClassAndSubject`
  - Keep `findByClassId`, `findByStaffId`, `save`, `deleteByClassId`, `deleteByStaffId`
  - Update `delete(classId, staffId, subjectId)` → `delete(classId, staffId)`
  - Add `findHomeroomByClassId(classId)` returning `ClassStaff | null` (used by HOMEROOM uniqueness check)
  - Add `update(classStaff)` for role changes

- **FR-12**: Decision doc at @doc/decisions/subject-removal capturing:
  - Why removed (no consumer feature in roadmap window; was forcing wrong staffing constraints)
  - When subject conceptually returns (curriculum-domain tag for lesson plan / daily report / observation portfolio / report card features)
  - Deferred enum values and their reservation: SPECIALIST (when filtering by specialty needed), CARETAKER (reserved for bảo mẫu / non-teaching hygiene-feeding role)
  - Mapping of Vietnamese roles to enum values
  - References to this spec and to roadmap items that will trigger the return
### Non-Functional Requirements

- **NFR-1**: HOMEROOM uniqueness enforced at two layers (domain + DB partial index) per defense-in-depth. Domain layer produces user-friendly error codes; DB layer is the safety net.
- **NFR-2**: All three mutation use cases go through `unitOfWork.run` (project convention from [[unit-of-work-convention]]).
- **NFR-3**: API breaking changes ship synchronously with FE update — no deprecation window.
- **NFR-4**: I18n boundary respected — backend stores English enum; UI renders Vietnamese/English labels via translation files.
- **NFR-5**: Test coverage — unit tests for use cases (assign, remove, change-role) covering HOMEROOM uniqueness, campus mismatch, not-found paths, and audit emission. Existing assign/remove tests refactored to drop subject and add role.

## Acceptance Criteria

- [ ] **AC-1**: `Subject` entity, repository port, Prisma mapper, Prisma repository, `GetAllSubjectsUseCase`, `SubjectResponse` DTO, and `GET /reference-data/subjects` endpoint are removed from the codebase. No imports remain.
- [ ] **AC-2**: `ClassStaff` Prisma model has PK `@@id([classId, staffId])` and a required `role` column of type `ClassStaffRole`. `subjectId` column is absent. `subject` table does not exist.
- [ ] **AC-3**: Partial unique index `class_staff_homeroom_unique` exists in the DB (verified via `\d class_staff` or migration assertion). Attempting to insert a second HOMEROOM row for the same `classId` raises a unique-violation error at the DB layer.
- [ ] **AC-4**: `POST /classes/:id/staff` accepts `{ staffId, role }` body (no `subjectId`), returns 201 with `ClassStaffResponse` containing `role`. Campus mismatch returns 400; class or staff not found returns 404; duplicate `(classId, staffId)` returns 409 with `STAFF_ALREADY_ASSIGNED`; second HOMEROOM returns 409 with `HOMEROOM_ALREADY_ASSIGNED`.
- [ ] **AC-5**: `DELETE /classes/:classId/staff/:staffId` removes the assignment and returns 204. Missing assignment returns 404. No `/subjects/:subjectId` path segment exists.
- [ ] **AC-6**: `PATCH /classes/:classId/staff/:staffId` accepts `{ role }`, updates the row, returns 200 with updated `ClassStaffResponse`. No-op (same role) returns 200 with existing row and emits no audit event. Change to HOMEROOM when another exists returns 409 with `HOMEROOM_ALREADY_ASSIGNED`. Missing assignment returns 404.
- [ ] **AC-7**: All three mutation actions (assign, remove, change-role) emit audit events with the documented context shapes. The audit-event-context-shapes reference (@doc/references/audit-event-context-shapes) is updated with the three shapes. Audit events are emitted inside `unitOfWork.run`.
- [ ] **AC-8**: `ClassStaffRole` is defined as a Prisma enum (`HOMEROOM`, `ASSISTANT`, `BOARDING`) and exposed as a domain-layer type. No leakage of Prisma types into application/domain layers.
- [ ] **AC-9**: The decision doc @doc/decisions/subject-removal exists, captures rationale + return path + deferred values, and is referenced from this spec and from the `decisions/` folder index.
- [ ] **AC-10**: Existing unit tests for `AssignStaffToClassUseCase` and `RemoveStaffFromClassUseCase` updated to remove subject dependency and add role. New tests added for `ChangeClassStaffRoleUseCase` and HOMEROOM uniqueness invariant. All `npm run test` passes.
- [ ] **AC-11**: Single Prisma migration drops `subject` table, drops `subjectId` from `class_staff`, adds `role` column with `ASSISTANT` backfill default, then removes the default. Migration is idempotent — re-running on a partially-migrated DB is safe.
- [ ] **AC-12**: Frontend coordination — FE team consumes the new contract; both deploy together. (Out of scope for this spec to verify FE; backend ships when FE is ready.)
## Scenarios

### Scenario 1: Assign first staff as homeroom (happy path)
**Given** a class with no staff assignments
**When** `POST /classes/:id/staff` with `{ staffId, role: 'HOMEROOM' }`
**Then** response is 201 with `ClassStaffResponse` containing `role: 'HOMEROOM'`; a new row exists in `class_staff` with `role = 'HOMEROOM'`; an audit event `staff.assigned_to_class` is emitted with `{ classId, staffId, role: 'HOMEROOM' }`

### Scenario 2: Cannot assign second HOMEROOM (domain invariant)
**Given** a class already has a HOMEROOM teacher assigned
**When** `POST /classes/:id/staff` with `{ staffId: differentStaff, role: 'HOMEROOM' }`
**Then** response is 409 with error code `HOMEROOM_ALREADY_ASSIGNED`; no row is created; no audit event is emitted

### Scenario 3: Multiple assistants and a boarding teacher
**Given** a class with one HOMEROOM
**When** `POST` is called three times with `{ staffId: X, role: 'ASSISTANT' }`, `{ staffId: Y, role: 'ASSISTANT' }`, `{ staffId: Z, role: 'BOARDING' }`
**Then** all three return 201; class now has 1 HOMEROOM + 2 ASSISTANTs + 1 BOARDING; three audit events emitted

### Scenario 4: Promote ASSISTANT to HOMEROOM when slot is open
**Given** a class with an ASSISTANT (staff B) and no HOMEROOM
**When** `PATCH /classes/:classId/staff/B` with `{ role: 'HOMEROOM' }`
**Then** response is 200 with `role: 'HOMEROOM'`; row updated; audit event `staff.role_changed` emitted with `{ classId, staffId: B, previousRole: 'ASSISTANT', newRole: 'HOMEROOM' }`

### Scenario 5: Cannot promote to HOMEROOM when another exists
**Given** a class with HOMEROOM (staff A) and ASSISTANT (staff B)
**When** `PATCH /classes/:classId/staff/B` with `{ role: 'HOMEROOM' }`
**Then** response is 409 with `HOMEROOM_ALREADY_ASSIGNED`; B's role unchanged; no audit event

### Scenario 6: PATCH with same role is a no-op
**Given** an ASSISTANT assignment
**When** `PATCH /classes/:classId/staff/:staffId` with `{ role: 'ASSISTANT' }`
**Then** response is 200 with the existing row; no DB write; no audit event emitted

### Scenario 7: Remove a HOMEROOM, then promote ASSISTANT to HOMEROOM
**Given** a class with HOMEROOM (A) and ASSISTANT (B)
**When** `DELETE /classes/:classId/staff/A`, then `PATCH /classes/:classId/staff/B` with `{ role: 'HOMEROOM' }`
**Then** DELETE returns 204 + emits `staff.removed_from_class` with `role: 'HOMEROOM'`; PATCH returns 200 + emits `staff.role_changed` with `previousRole: 'ASSISTANT', newRole: 'HOMEROOM'`; final state: 1 HOMEROOM (B), no other staff

### Scenario 8: Cross-campus rejection preserved
**Given** a staff member belonging to a different campus than the class
**When** `POST /classes/:id/staff` with that staffId
**Then** response is 400 with campus mismatch error (existing behavior preserved); no row created

### Scenario 9: DB partial index catches HOMEROOM race
**Given** two concurrent `POST /classes/:id/staff` requests with `{ role: 'HOMEROOM' }` for the same class but different staff
**When** both pass the domain check before either commits
**Then** one transaction commits, the other fails on DB unique violation; the failing request returns 409 (translated by repository or controller); class ends with exactly one HOMEROOM

## Technical Notes

- **Patterns to follow**:
  - [[unit-of-work-pattern]] for all three mutations
  - [[mapper-pattern]] — note Prisma `Update` vs `UncheckedUpdate` distinction (from project memory: FK fields silently ignored on regular UpdateInput). Role isn't an FK so regular UpdateInput is fine here.
  - [[entity-pattern]] for `ClassStaff.changeRole()` returning new immutable instance
  - [[repository-pattern]] for port-vs-Prisma separation

- **Migration sequencing**:
  1. Add `role` column to `class_staff` with default `ASSISTANT` and NOT NULL
  2. Drop FK `class_staff.subjectId → subject.id`
  3. Drop `subjectId` column from `class_staff`
  4. Drop old composite PK `(classId, staffId, subjectId)`, add new PK `(classId, staffId)` — needs deduplication of any `(classId, staffId)` pairs that became duplicates; since data is dev-only, a safe choice is to keep the first row arbitrarily (or wipe and let dev re-seed)
  5. Add partial unique index `class_staff_homeroom_unique`
  6. Drop `subject` table
  7. Remove the `ASSISTANT` default from `role` column (now required without default)
  8. Drop `@@index([subjectId])` from class_staff (gone with the column)

- **i18n labels** live in the frontend translation files, not backend. Backend only stores enum values.

- **Partial unique index requires raw SQL** in the Prisma migration (`prisma migrate dev` lets you edit the generated SQL or insert raw SQL via `Prisma.sql\`\``). Document the SQL in the migration file.

- **`ChangeClassStaffRoleUseCase` no-op behavior**: when `newRole === existingRole`, do not write to DB and do not emit audit. Return the existing row so the FE gets a consistent response shape.

- **Audit event timing**: emit inside `unitOfWork.run` after the DB write succeeds, per [[unit-of-work-convention]].

- **Error code constants**: create or extend a class-staff error-codes module mirroring the pattern in `src/application/class-management/enrollment-error-codes.ts`. Codes needed: `HOMEROOM_ALREADY_ASSIGNED`, `STAFF_ALREADY_ASSIGNED`, `STAFF_NOT_FOUND_IN_CLASS`.

- **Decision doc structure** at `decisions/subject-removal`:
  - Context (why subject existed)
  - Decision (drop entirely + reshape ClassStaff)
  - Consequences (API breaking; FE coordinates)
  - When subject returns (curriculum-domain tag — references future roadmap features: lesson plan, daily report, observation/portfolio, report card)
  - Deferred enum values (SPECIALIST for năng khiếu, CARETAKER for bảo mẫu) with their reservation note
  - Vietnamese ↔ English role mapping table

## Open Questions

- None blocking. All gray areas locked during exploration phase.
- Implementation question for planner (not spec-level): exact file path for `ClassStaffRole` domain type — likely `src/domain/class-management/value-objects/class-staff-role.ts` matching codebase conventions, but planner can confirm against [[naming-conventions]].
