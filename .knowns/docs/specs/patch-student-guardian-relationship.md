---
title: Patch Student Guardian Relationship
description: 'Spec for new PATCH endpoints that update the relationship type on an existing student-guardian link in-place, replacing the frontend''s non-atomic DELETE+POST flow'
createdAt: '2026-04-18T00:48:23.838Z'
updatedAt: '2026-04-18T01:17:17.666Z'
tags:
  - spec
  - approved
  - student-guardian
  - from-conversation
---

## Overview

Add a PATCH endpoint to update the relationship type on an existing student↔guardian link in-place, replacing the frontend's current non-atomic DELETE+POST workflow. The existing flow leaves the student unlinked from the guardian if POST fails after DELETE succeeds, produces a noisy audit trail (delete + create instead of one update), and causes UI flicker.

Two endpoints are exposed as aliases, both hitting the same join row in `guardian_student`:
- `PATCH /students/:studentId/guardians/:guardianId`
- `PATCH /guardians/:guardianId/students/:studentId`

## Locked Decisions

- **D1:** Expose both endpoints as aliases. Both delegate to the same `UpdateStudentGuardianRelationshipUseCase`; controllers act as thin adapters.
- **D2:** Match the existing link-flow convention for relationship-type validation. `relationshipId` not-found → `NotFoundException` (404). Archived `relationshipId` → `BadRequestException` (400). Mirrors `link-student-with-guardian.use-case.ts:48-61`.
- **D3:** Strict campus-ownership cross-check inside the use case: both `student.campusId` and `guardian.campusId` must equal the header campusId, else 404. Schema invariant (`Guardian` has required `campusId`; a parent with kids at multiple campuses is modeled as separate `Guardian` rows per campus) makes this safe — defends a real invariant without rejecting legitimate states. POST/DELETE currently lack this check; backfill tracked as a separate follow-up task.
- **D4:** Response shape reuses `LinkStudentGuardianResponse` as-is: `{ studentId, guardianId, relationshipId, relationshipName }`. Symmetric with the POST response.

## Requirements

### Functional Requirements

- **FR-1:** `PATCH /students/:studentId/guardians/:guardianId` updates `guardian_relationship_id` on the matching join row in-place (single SQL `UPDATE`, no delete-and-recreate).
- **FR-2:** `PATCH /guardians/:guardianId/students/:studentId` provides the guardian-side alias; identical behavior and response shape.
- **FR-3:** Request body accepts a single field `{ "relationshipId": "<uuid>" }`. Validated as UUID v4. No `campusId` in body (campus comes from `X-Campus-Id` header).
- **FR-4:** Response on success returns 200 with `LinkStudentGuardianResponse` — `{ studentId, guardianId, relationshipId, relationshipName }`.
- **FR-5:** Both endpoints require `ClerkAuthGuard`, `@RequireCampusAccess()`, and `X-Campus-Id` header (same as existing link/unlink endpoints).
- **FR-6:** Sending the same `relationshipId` currently stored on the row is a valid no-op and returns 200 with the unchanged DTO.

### Error Requirements

- **FR-7:** No join row between `studentId` and `guardianId` → `NotFoundException` (404).
- **FR-8:** `student.campusId` ≠ header campusId OR `guardian.campusId` ≠ header campusId → `NotFoundException` (404). Do not leak existence across campus boundaries.
- **FR-9:** `relationshipId` does not exist → `NotFoundException` (404).
- **FR-10:** `relationshipId` exists but is archived → `BadRequestException` (400).
- **FR-11:** Malformed UUID in path or body → 400 via `ParseUUIDPipe` / `class-validator`.

### Non-Functional Requirements

- **NFR-1:** Use case ships with unit test coverage matching the module's existing conventions (mock-repository-factory pattern).
- **NFR-2:** No new response-shape DTO classes. Reuse `LinkStudentGuardianResponse`.
- **NFR-3:** No changes to the POST/DELETE link flow or its use cases within this spec. Campus-ownership backfill is a separate task.

## Acceptance Criteria

- [ ] AC-1: `PATCH /students/:studentId/guardians/:guardianId` with a valid `relationshipId` updates the row and returns 200 with `LinkStudentGuardianResponse`.
- [ ] AC-2: `PATCH /guardians/:guardianId/students/:studentId` produces identical behavior and response for the same (studentId, guardianId) pair.
- [ ] AC-3: Both endpoints are declared on their respective controllers (`StudentController`, `GuardianController`) and share a single `UpdateStudentGuardianRelationshipUseCase`.
- [ ] AC-4: No existing join row → 404 with a message naming both IDs.
- [ ] AC-5: Student or guardian not in header campus → 404.
- [ ] AC-6: `relationshipId` not found → 404.
- [ ] AC-7: `relationshipId` archived → 400 with a message referencing the relationship name.
- [ ] AC-8: Re-sending the current `relationshipId` returns 200 with the same DTO (no-op).
- [ ] AC-9: `StudentRepository` port gains `updateGuardianRelationship(studentId, guardianId, relationshipId)` with a Prisma implementation using the composite `studentId_guardianId` unique key.
- [ ] AC-10: `createMockStudentRepository` in `src/test-utils/mock-repository-factory.ts` includes the new method.
- [ ] AC-11: Use case unit tests cover the happy path and all error branches listed above.
- [ ] AC-12: Swagger docs include both endpoints with `X-Campus-Id` header and UUID param decorators (matching the neighboring POST/DELETE/GET endpoints).

## Scenarios

### Scenario 1: Happy path (relationship change)

**Given** a student S and guardian G exist in campus C with an existing link carrying relationshipId R_old
**And** R_new is a non-archived relationship type
**When** the frontend calls `PATCH /students/S/guardians/G` with body `{ "relationshipId": "R_new" }` and header `X-Campus-Id: C`
**Then** the join row's `guardian_relationship_id` is updated to R_new in a single SQL UPDATE
**And** the response is 200 with `{ studentId: S, guardianId: G, relationshipId: R_new, relationshipName: "<R_new.name>" }`

### Scenario 2: Alias endpoint

**Given** the same preconditions as Scenario 1
**When** the frontend calls `PATCH /guardians/G/students/S` with body `{ "relationshipId": "R_new" }` and header `X-Campus-Id: C`
**Then** the row updates identically and the response matches Scenario 1

### Scenario 3: Link does not exist (404)

**Given** no join row exists between student S and guardian G
**When** `PATCH /students/S/guardians/G` is called
**Then** the response is 404 `NotFoundException`

### Scenario 4: Relationship type archived (400)

**Given** a link exists between S and G
**And** R_new.isArchived = true
**When** `PATCH /students/S/guardians/G` is called with `{ "relationshipId": "R_new" }`
**Then** the response is 400 `BadRequestException` referencing the archived relationship name

### Scenario 5: Cross-campus request (404, no leak)

**Given** student S belongs to campus C1 and guardian G belongs to campus C1
**And** the caller sends `X-Campus-Id: C2`
**When** `PATCH /students/S/guardians/G` is called
**Then** the response is 404 (not 403 or 400), matching existence-checking conventions

### Scenario 6: No-op (same relationship ID)

**Given** the current `guardian_relationship_id` is R
**When** `PATCH /students/S/guardians/G` is called with `{ "relationshipId": "R" }`
**Then** the response is 200 with the unchanged DTO

## Technical Notes

**Target DB operation:**

```sql
UPDATE guardian_student
SET guardian_relationship_id = :relationshipId,
    updated_at = now()
WHERE student_id = :studentId AND guardian_id = :guardianId
```

Executed via Prisma using the composite unique key:

```ts
prisma.guardianStudent.update({
  where: { studentId_guardianId: { studentId, guardianId } },
  data: { guardianRelationshipId: relationshipId },
});
```

The use case pre-checks campus and link existence, so the Prisma `update` call is only reached when the row is guaranteed to exist.

**Use case checks (ordered):**

1. Look up `relationshipType` by ID; 404 if missing, 400 if archived. Mirrors existing link flow.
2. Look up `student` by ID; 404 if missing OR `student.campusId !== campusId`.
3. Look up `guardian` by ID; 404 if missing OR `guardian.campusId !== campusId`.
4. Load link via `studentRepository.getStudentGuardians(studentId)`; 404 if no row for `guardianId`.
5. Call `studentRepository.updateGuardianRelationship(studentId, guardianId, relationshipId)`.
6. Return `{ studentId, guardianId, relationshipId, relationshipName }`.

**Files to create:**

- `src/application/user-management/use-cases/student/update-student-guardian-relationship.use-case.ts`
- `src/application/user-management/use-cases/student/update-student-guardian-relationship.use-case.spec.ts`
- `src/infra/http/dtos/user-management/student/update-student-guardian.request.ts`

**Files to modify:**

- `src/application/user-management/ports/student.repository.ts` — add abstract `updateGuardianRelationship`.
- `src/infra/persistence/prisma/repositories/prisma-student.repository.ts` — implement method.
- `src/infra/http/controllers/user-management/student.controller.ts` — add `@Patch(":id/guardians/:guardianId")` handler.
- `src/infra/http/controllers/user-management/guardian.controller.ts` — add `@Patch(":id/students/:studentId")` handler.
- `src/infra/http/modules/user-management.module.ts` — register the new use case.
- `src/infra/http/dtos/user-management/student/index.ts` — export new request DTO.
- `src/test-utils/mock-repository-factory.ts` — add `updateGuardianRelationship: jest.fn()` to `createMockStudentRepository`.

**Reused primitives:**

- `LinkStudentGuardianResponse` DTO (no changes).
- `GuardianRelationshipTypeRepository.findById` + archived check.
- `@CampusContext()`, `@RequireCampusAccess()`, `ClerkAuthGuard`, `ParseUUIDPipe`, `@StandardResponse`.
- Campus-scoping pattern from `get-student-guardians.use-case.ts:28`.

## Open Questions

None at this time — all gray areas resolved in Phase 0.

## Spillover

- **Separate task recommended:** backfill campus-ownership cross-check into the existing link/unlink use cases (`link-student-with-guardian.use-case.ts`, `link-student-to-guardian.use-case.ts`, `unlink-student-from-guardian.use-case.ts` × 2). Known gap, safety-positive, but out of scope for this spec to keep blast radius small.
