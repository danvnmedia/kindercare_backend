---
title: Direct Role Assignment via UoW
description: 'Backend refactor that replaces the campus-blind roleRepository.assignUsers/removeUsers path with a UoW-driven flow. Adds tx.revokeRoles symmetric to tx.assignRoles, gates POST/DELETE /roles/:id/users on @RequireCampusAccess + @CampusContext, restricts the endpoint to campus-scoped roles only (system roles rejected with 400), and emits GRANT_ROLE / REVOKE_ROLE audit events atomically in the same transaction with per-pair granularity. Builds on @doc/specs/tracked-grant-revocation (tx.assignRoles provenance + D5 conflict semantics already shipped).'
createdAt: '2026-05-25T17:39:13.437Z'
updatedAt: '2026-05-25T20:28:56.833Z'
tags:
  - spec
  - draft
  - backend
  - rbac
  - user-management
  - audit
  - schema-change
---

## Overview

The admin endpoints `POST /roles/:id/users` and `DELETE /roles/:id/users` today bypass the Unit of Work and write `UserRole` rows via `roleRepository.assignUsers/removeUsers`, which omit `campusId` — every grant lands as a global assignment (`campusId = NULL`), regardless of the active campus. This refactor:

1. Migrates both endpoints onto the UoW path, reusing the existing `tx.assignRoles` (provenance-aware, D5-compliant) shipped by @doc/specs/tracked-grant-revocation.
2. Adds a new symmetric `tx.revokeRoles(userId, removals)` op for manual revocation by `(roleId, campusId)` — distinct from `revokeRolesByProvenance` which is scoped to staff-type-driven grants.
3. Restricts the endpoint surface to **campus-scoped roles only** — system roles (`role.campusId === null`) are rejected at the use case with 400. System-role grants remain seed/migration-only.
4. Emits `GRANT_ROLE` / `REVOKE_ROLE` audit events atomically alongside the write, at per-pair granularity (one audit row per `(userId, roleId, campusId)` touched), with no-op suppression matching the tracked-grant-revocation D5 pattern.
5. Deletes the now-dead `roleRepository.assignUsers/removeUsers` port methods, Prisma impls, and mock-factory entries.

The change unblocks safe campus-scoped role management from the admin UI without leaking grants across campuses, and lands the audit hook that the broader admin-audit-log effort assumes for these actions.

## Locked Decisions

- **D1: Per-pair audit granularity.** One audit row per `(userId, roleId, campusId)` pair touched. `targetType='user'`, `targetId=<userId>`, `context={ roleId, campusId, actorName }`. Multi-user batches emit N rows. Matches the existing `LINK_GUARDIAN_TO_STUDENT` / `ASSIGN_STAFF_TO_CLASS` pair-action shape.
- **D2: Action vocabulary `GRANT_ROLE` / `REVOKE_ROLE`.** New entries in the curated `AuditAction` vocabulary (`src/domain/audit`), visibility `ADMIN`. Names track RBAC standard verbs (SQL GRANT/REVOKE) rather than the existing ASSIGN/REMOVE convention because role attachment is conceptually a permission-grant, not a relation-link.
- **D3: Campus-scoped roles only.** Endpoint rejects with 400 BadRequest when `role.campusId === null`. Invariant `assignment.campusId === role.campusId === activeCampusId` holds for every successful write. System roles continue to be created via seeds/migrations only; granting them via HTTP is out of scope (separate privileged endpoint, if ever).
- **D4: No audit on no-op.** When `tx.assignRoles` returns `inserted=0` (D5 manual-wins conflict) or `tx.revokeRoles` returns `deleted=0` (the user did not hold the role-campus pair), no audit row is written for that pair. The audit table mirrors actual state changes, not admin intent. Symmetric to `update-staff.use-case.ts` (`rolesGranted/rolesRevoked` stay empty when count=0).
- **D5: Pre-validate + single-transaction all-or-none.** Phase 1 outside UoW: load role, reject if `role.campusId === null`, load each user, reject on first missing. Phase 2 inside `unitOfWork.run`: loop users, call `tx.assignRoles`/`tx.revokeRoles` per user, emit audit when count > 0. Any DB-level throw inside the closure rolls back the entire batch (inserts + audits). No partial success.
- **D6: Delete legacy repo methods.** `roleRepository.assignUsers/removeUsers` port methods, their Prisma impls, and `mock-repository-factory.ts` entries are removed in this spec. Zero callers remain after the use case migration.
- **D7: Campus from `X-Campus-Id` header.** Controller adds `@CampusContext()` + `@RequireCampusAccess()`. Body shape unchanged: `{ userIds: string[] }`. Matches every other campus-scoped endpoint (`/staff`, `/staff-types`, etc.).

## Requirements

### Functional Requirements

- **FR-1: New UoW port op `tx.revokeRoles`.** `TransactionContext.revokeRoles(userId: string, removals: Array<{ roleId: string; campusId: string | null }>): Promise<number>` deletes matching `user_roles` rows and returns the count deleted. Filters by exact `(userId, roleId, campusId)` tuple; never matches by provenance. Distinct from `revokeRolesByProvenance` in shape and intent.
- **FR-2: Audit action vocabulary additions.** Add `GRANT_ROLE` and `REVOKE_ROLE` to `AUDIT_ACTIONS` and the `AuditAction` type. Both default to `'ADMIN'` visibility in `ACTION_VISIBILITY`. The compile-time exhaustiveness check + runtime drift guard in `action-visibility.ts` enforce coverage.
- **FR-3: `AssignUsersToRoleUseCase` UoW migration.** Use case input becomes `{ roleId, userIds, campusId }`. Pre-validate (load role + reject system-role; load each user + 404 on missing; verify `role.campusId === campusId`). Inside `unitOfWork.run`: per user, call `tx.assignRoles(userId, [{ roleId, campusId, grantedViaStaffTypeId: null }])`; when `inserted > 0`, call `tx.recordAudit(...)` with `action='GRANT_ROLE'`, `targetType='user'`, `targetId=userId`, `context={ roleId, campusId, actorName }`.
- **FR-4: `RemoveUsersFromRoleUseCase` UoW migration.** Same shape as FR-3 but calls `tx.revokeRoles(userId, [{ roleId, campusId }])`; emits `REVOKE_ROLE` audit when `deleted > 0`. Same pre-validation, including campus-compat.
- **FR-5: Controller campus gating.** `POST /roles/:id/users` and `DELETE /roles/:id/users` decorated with `@RequireCampusAccess()` and accept `@CampusContext() campusId: string`. CampusId is passed into the use case alongside the existing `userIds`. `X-Campus-Id` header becomes mandatory.
- **FR-6: Legacy code removal.** `roleRepository.assignUsers`, `roleRepository.removeUsers` (port + Prisma impl), and `mock-repository-factory.ts` mock entries are deleted. `RoleRepository` port surface shrinks accordingly. No other callers exist (verified by grep).
- **FR-7: Audit context shape doc.** `@doc/references/audit-event-context-shapes` is extended with sections for `GRANT_ROLE` and `REVOKE_ROLE` matching the existing per-action shape documentation. Each documents `targetType='user'`, `targetId`, and `context={ roleId: string, campusId: string, actorName: string | null }`.

### Non-Functional Requirements

- **NFR-1: Atomicity (transactional).** Per D5, every successful request commits all writes (N user_role mutations + ≤ N audit rows) in a single Prisma `$transaction`. Failure inside the closure rolls back all of them.
- **NFR-2: Backward compatibility of UoW port.** Existing `tx.assignRoles` callers (CreateStaff, UpdateStaff) are not touched. Adding `tx.revokeRoles` is purely additive; no existing op signatures change.
- **NFR-3: No schema migration.** `UserRole.campusId` already exists (`String?`), `@@unique([userId, roleId, campusId])` already in place. No DB schema work in this spec.

## Acceptance Criteria

- [x] AC-1: `TransactionContext.revokeRoles(userId, removals)` exists on the port with the exact signature from FR-1; documented with JSDoc explaining the distinction from `revokeRolesByProvenance`.
- [x] AC-2: Prisma impl of `revokeRoles` uses `deleteMany({ where: { userId, OR: removals.map(...) } })` and returns the deleted count.
- [x] AC-3: `AUDIT_ACTIONS` and `AuditAction` type include `GRANT_ROLE` and `REVOKE_ROLE`; `ACTION_VISIBILITY` entries default both to `'ADMIN'`; runtime drift check still passes.
- [x] AC-4: `AssignUsersToRoleUseCase` accepts `{ roleId, userIds, campusId }`, rejects with 400 when `role.campusId === null`, rejects with 400 when `role.campusId !== campusId`, rejects with 404 when any userId is missing — all before entering the UoW.
- [x] AC-5: `AssignUsersToRoleUseCase` inside the UoW writes `tx.assignRoles(userId, [{ roleId, campusId, grantedViaStaffTypeId: null }])` per user, and emits a `GRANT_ROLE` audit only when `inserted > 0`.
- [x] AC-6: `RemoveUsersFromRoleUseCase` mirrors AC-4 + AC-5 with `tx.revokeRoles` and `REVOKE_ROLE`, emitting audit only when `deleted > 0`.
- [x] AC-7: Controller methods for both endpoints are decorated with `@RequireCampusAccess()` and use `@CampusContext() campusId: string`; request without `X-Campus-Id` header → 400/403 per the existing CampusGuard contract.
- [x] AC-8: `roleRepository.assignUsers`, `roleRepository.removeUsers`, the Prisma impls, and the corresponding mock-factory entries are deleted; project compiles + tests pass with zero references remaining.
- [x] AC-9: Unit tests for both use cases cover: campus-compat reject (campus-A role + campus-B header → 400), system-role reject (role.campusId=null → 400), user-not-found pre-validate (404, no UoW entered), happy-path grant (assignRoles called with full provenance shape, GRANT_ROLE emitted), D5 conflict no-op (inserted=0 → no audit), revoke miss (deleted=0 → no audit), batch with one D5 + rest fresh (audits match inserted count).
- [x] AC-10: Integration test asserting transactional rollback: `tx.assignRoles` throws on user N of a batch → no user_role rows inserted (including users 1..N-1), no audit rows landed. Mirrors `update-staff-tracked-grant.integration.spec.ts` pattern.
- [x] AC-11: `@doc/references/audit-event-context-shapes` updated with the two new sections per FR-7.
- [x] AC-12: `npm run build` passes; `npm test` passes; `mcp_knowns_validate` on the spec passes.

## Scenarios

### Scenario 1: Happy-path grant (single user)

**Given** a campus-scoped role `teacher-campus-a` (role.campusId = campus-A) and a user u1 with no prior `(u1, teacher-campus-a, campus-A)` row
**When** an admin authenticated under `X-Campus-Id: campus-A` calls `POST /roles/teacher-campus-a/users` with `{ userIds: ["u1"] }`
**Then** the response is 200, one `user_roles` row is inserted with `userId=u1, roleId=teacher-campus-a, campusId=campus-A, grantedViaStaffTypeId=NULL`, and one `audit_event` row lands with `action='GRANT_ROLE', targetType='user', targetId='u1', context.roleId='teacher-campus-a', context.campusId='campus-A'`. Both writes are inside a single Prisma transaction.

### Scenario 2: Batch grant with mixed D5

**Given** users u1 (no grant) and u2 (already has the role-campus pair via prior manual grant)
**When** admin posts `{ userIds: ["u1", "u2"] }`
**Then** the response is 200, one `user_roles` row inserted (u1), one `GRANT_ROLE` audit row written (for u1), zero rows for u2 (D5 manual-wins, `tx.assignRoles` returns inserted=0 for that pair → audit suppressed per D4).

### Scenario 3: System-role rejection

**Given** a system role `super-admin` (role.campusId = NULL)
**When** admin posts `POST /roles/super-admin/users` with `X-Campus-Id: campus-A` and any userIds
**Then** the response is 400 with message "Cannot grant system roles via this endpoint"; no UoW closure runs; no writes occur.

### Scenario 4: Cross-campus role rejection

**Given** role `teacher-campus-b` (role.campusId = campus-B)
**When** admin posts to grant it with `X-Campus-Id: campus-A`
**Then** the response is 400 with a message naming the campus mismatch; no UoW closure runs; no writes occur.

### Scenario 5: User-not-found pre-validation

**Given** userIds `["u1", "u-doesnt-exist", "u3"]`
**When** admin posts the batch
**Then** the response is 404 with the missing userId; no UoW closure runs; no rows inserted or audited (including for u1).

### Scenario 6: Transactional rollback on mid-batch throw

**Given** userIds `["u1", "u2", "u3"]`, all validated, all eligible
**When** `tx.assignRoles` for u2 throws (e.g., FK constraint, simulated DB error)
**Then** the outer `unitOfWork.run` rejects, the request returns 500, and the database state shows zero new `user_roles` rows for u1/u2/u3 and zero audit rows from the batch. The Prisma `$transaction` rollback covers everything.

### Scenario 7: Happy-path revoke

**Given** user u1 holds `(u1, teacher-campus-a, campus-A)` via a prior grant
**When** admin calls `DELETE /roles/teacher-campus-a/users` with `{ userIds: ["u1"] }` under `X-Campus-Id: campus-A`
**Then** the row is deleted, one `REVOKE_ROLE` audit row lands with `targetId='u1', context={roleId, campusId, actorName}`, and the response is 200.

### Scenario 8: Revoke miss (D4)

**Given** user u2 does not hold the role-campus pair
**When** admin calls `DELETE /roles/.../users` with `userIds: ["u2"]`
**Then** `tx.revokeRoles` returns `deleted=0`, no audit row is written, and the response is 200 (idempotent — admin asked for X to not have the role, X does not have the role, done).

### Scenario 9: Manual revoke does NOT delete tracked grants (boundary with tracked-grant-revocation)

**Given** user u3 holds the role via auto-grant from a staff type (`granted_via_staff_type_id IS NOT NULL`)
**When** admin calls `DELETE /roles/.../users` with `userIds: ["u3"]`
**Then** the row IS deleted (manual revoke matches by `(userId, roleId, campusId)` regardless of provenance) and one `REVOKE_ROLE` audit lands. This is intentional: admin override beats system-derived intent, symmetric to D5 manual-wins on the grant side.

## Technical Notes

### Schema delta

None. `UserRole.campusId` and the unique constraint `@@unique([userId, roleId, campusId])` are already in place. `granted_via_staff_type_id` was added by @task-zgna55.

### Port surface change

`TransactionContext` (`@/application/ports/unit-of-work.port.ts`) gains:

```typescript
/**
 * Revoke specific role assignments matching exact (userId, roleId, campusId)
 * tuples, regardless of provenance.
 *
 * Used by admin direct-revoke endpoints to delete manual or tracked rows by
 * their natural key. Distinct from `revokeRolesByProvenance` which filters by
 * `granted_via_staff_type_id` (used only by staff-type-driven auto-revoke).
 *
 * @returns the number of rows actually deleted (0 when the user does not hold
 *   any of the specified pairs).
 */
revokeRoles(
  userId: string,
  removals: Array<{ roleId: string; campusId: string | null }>,
): Promise<number>;
```

Implementation uses `prisma.userRole.deleteMany({ where: { userId, OR: removals.map(r => ({ roleId: r.roleId, campusId: r.campusId })) } })` and returns `result.count`.

### Audit context shapes — addition only

```jsonc
// GRANT_ROLE
{
  "action": "GRANT_ROLE",
  "targetType": "user",
  "targetId": "<userId>",
  "context": {
    "roleId": "<roleId>",
    "campusId": "<campusId>",
    "actorName": "<actor name or null>"
  }
}

// REVOKE_ROLE — identical shape, action differs
{
  "action": "REVOKE_ROLE",
  "targetType": "user",
  "targetId": "<userId>",
  "context": {
    "roleId": "<roleId>",
    "campusId": "<campusId>",
    "actorName": "<actor name or null>"
  }
}
```

Visibility: `ADMIN` for both. Compile-time exhaustiveness in `action-visibility.ts` will force the additions; runtime drift guard catches missing entries at module load.

### Use-case flow — `AssignUsersToRoleUseCase` (illustrative)

```typescript
async execute(input: { roleId: string; userIds: string[]; campusId: string }) {
  // Phase 1: pre-validation (outside UoW)
  const role = await this.roleRepository.findById(input.roleId);
  if (!role) throw new NotFoundException(`Role ${input.roleId} not found`);
  if (role.campusId === null) {
    throw new BadRequestException("Cannot grant system roles via this endpoint");
  }
  if (role.campusId !== input.campusId) {
    throw new BadRequestException(
      `Role belongs to campus ${role.campusId}, not ${input.campusId}`,
    );
  }
  for (const userId of input.userIds) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
  }

  // Phase 2: transactional writes
  await this.unitOfWork.run(async (tx) => {
    for (const userId of input.userIds) {
      const inserted = await tx.assignRoles(userId, [
        { roleId: input.roleId, campusId: input.campusId, grantedViaStaffTypeId: null },
      ]);
      if (inserted > 0) {
        await tx.recordAudit({
          actorId: this.requestContext.userId,
          action: "GRANT_ROLE",
          targetType: "user",
          targetId: userId,
          campusId: input.campusId,
          context: {
            roleId: input.roleId,
            campusId: input.campusId,
            actorName: this.requestContext.userName ?? null,
          },
        });
      }
    }
  });
}
```

`RemoveUsersFromRoleUseCase` mirrors this with `tx.revokeRoles` + `REVOKE_ROLE`.

### Implementation order (informational, not normative)

1. Port + Prisma impl: add `tx.revokeRoles` + unit tests (sibling pattern: `user.transaction-ops.spec.ts`).
2. Domain + application: add `GRANT_ROLE` / `REVOKE_ROLE` to `AUDIT_ACTIONS` + visibility map.
3. Use case: migrate `AssignUsersToRoleUseCase` → UoW path with audit.
4. Use case: migrate `RemoveUsersFromRoleUseCase` → UoW path with audit.
5. Controller: add `@CampusContext` + `@RequireCampusAccess`; thread campusId.
6. Legacy removal: drop `roleRepository.assignUsers/removeUsers` + Prisma impls + mock entries.
7. Doc: extend `@doc/references/audit-event-context-shapes` with the two new sections.
8. Integration test: rollback on mid-batch throw (Scenario 6).

### Out of scope

- `@Permissions("role.manage")` or `isGlobalAdmin()` gating on `/roles/:id/users` — tracked separately as part of the broader "RBAC coverage gap" follow-up. The endpoint remains behind `ClerkAuthGuard + CampusGuard` only.
- A "list users with role X" reverse-lookup endpoint (kept on the scale-later list).
- Auto-revoke side effects when a user changes campus or is deleted — separate concern.
- Refactoring `tx.assignRoles` to accept a flat `Array<{userId, roleId, campusId, ...}>` (batch-of-batches). Today the per-user loop inside the UoW is fine.
- Per-pair audit deduplication when admin re-runs the same batch quickly. The unique constraint + D5 path handle the user_role side; audit emission policy from D4 keeps the audit table clean.

## Open Questions

- [ ] Does the audit `context.campusId` field belong inside `context` or get hoisted out to the `audit_event.campus_id` top-level column? Current pattern (per `@doc/references/audit-event-context-shapes`) hoists campusId to the column; keep `context.campusId` only if redundancy is desired for FE filtering convenience. **Lean: drop from context, rely on the column.**
- [ ] Should `actorName` snapshotting come from `RequestContext` (current user's profile name) or from a fresh lookup at audit-write time? Sibling actions snapshot from `RequestContext`. **Lean: same source for consistency.**
