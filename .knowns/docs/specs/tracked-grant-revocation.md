---
title: Tracked-Grant Revocation
description: Backend refactor that adds provenance tracking to user_roles via a nullable granted_via_staff_type_id FK, switches staff-type-driven role grants from additive-only to revoke-then-assign within the existing UoW, preserves manual grants (null provenance) from auto-revocation, and extends EDIT_STAFF_PROFILE audit context with rolesGranted/rolesRevoked arrays. Prerequisite for the planned staff-multi-type-refactor.
createdAt: '2026-05-25T00:51:39.321Z'
updatedAt: '2026-05-25T14:24:58.425Z'
tags:
  - spec
  - approved
  - backend
  - rbac
  - user-management
  - schema-change
  - audit
---

## Overview

Today the codebase auto-assigns roles when a staff is created or has their staffType changed — but never auto-revokes. `update-staff.use-case.ts:381-407` calls `tx.assignRoles(...)` additively, so `Teacher → Principal` leaves the user with **both** TEACHER and PRINCIPAL roles indefinitely. There is no way for the system to know which roles it granted (vs which were granted manually by an admin), so cleanup requires manual intervention every time.

This spec adds **membership-tied revocation** to the RBAC system:

1. A new nullable column `granted_via_staff_type_id` on `user_roles` records *which staff type caused* the grant. Null = manual grant.
2. When a staff's `staffTypeId` changes, the system revokes user_role rows whose provenance matches the *old* type, then assigns a new row tagged with the *new* type's provenance — all in the existing unit-of-work transaction.
3. Manual grants (provenance=null) are never touched by tracked-grant logic.

This is also the prerequisite for the planned `staff-multi-type-refactor` (`@doc/specs/staff-multi-type-refactor` — not yet drafted). Once provenance exists, the multi-type refactor becomes a data-shape change rather than a policy change: it just iterates over a set of types using the same revoke/assign primitives.

## Locked Decisions

- **D1: Decoupled v1.** `UpdateStaffTypeUseCase` does NOT touch `user_roles` when `defaultRoleId` changes. Existing staff keep the prior grant; only future staff assignments get the new default. A future admin-triggered `POST /staff-types/:id/resync` endpoint is filed as a follow-up task and is out of scope here.
- **D2: All-null backfill.** Migration sets `granted_via_staff_type_id = NULL` on every existing `user_roles` row. Existing grants are treated as manual; tracked-grant logic only governs grants created from this deploy forward.
- **D3: Single audit event, extended context.** Role grant/revoke flips emitted during a staff edit ride on the existing `EDIT_STAFF_PROFILE` event. The event context gains two arrays: `rolesGranted: [{roleId, viaStaffTypeId}]` and `rolesRevoked: [{roleId, viaStaffTypeId}]`. Empty arrays when the update has no role impact.
- **D4: Archive/restore unchanged.** `ArchiveStaffUseCase` and `RestoreStaffUseCase` do NOT touch `user_roles`. The auth-layer deactivation (Clerk lock + `user.isActive = false`) remains the only mechanism for blocking archived users; role rows stay intact so restore is one-click.
- **D5: Manual grant wins on conflict.** If a tracked-grant assign tries to insert a row that violates the existing `@@unique([userId, roleId, campusId])` constraint, the existing row is preserved as-is. The auto-assign becomes a no-op for that row; provenance is NOT upgraded from null → tracked. Manual admin intent always supersedes system-derived intent.

## Requirements

### Functional Requirements

- **FR-1** Add `grantedViaStaffTypeId String?` (column `granted_via_staff_type_id @db.Uuid`) to the `UserRole` model with a relation to `StaffType` and `onDelete: SetNull`. Index the column.
- **FR-2** `CreateStaffUseCase`: when auto-assigning the default role from `staffType.defaultRoleId`, the inserted `user_roles` row must carry `granted_via_staff_type_id = input.staffTypeId`.
- **FR-3** `UpdateStaffUseCase`: when `staffTypeId` changes from `A` (possibly null) to `B` (possibly null):
  - If `A` is non-null, delete `user_roles` rows where `userId = staff.userId AND granted_via_staff_type_id = A` within the same UoW transaction. Only the staff's own campus is in scope.
  - If `B` is non-null and `B.defaultRoleId` is set, insert a new `user_roles` row tagged `granted_via_staff_type_id = B`. Subject to FR-5 (conflict policy).
  - Both operations skip silently if `staff.userId IS NULL`.
- **FR-4** Manual grants (`granted_via_staff_type_id IS NULL`) are never deleted or mutated by any tracked-grant logic, regardless of whether their `(userId, roleId, campusId)` matches what the system would have auto-granted.
- **FR-5** On unique-constraint conflict during tracked-grant insert (a row for `(userId, roleId, campusId)` already exists), preserve the existing row unchanged. The conflicting insert becomes a no-op. The existing row's `granted_via_staff_type_id` is NOT upgraded.
- **FR-6** All tracked-grant mutations (revoke + assign) must run inside the existing UoW that performs the staff update. A failure in either rolls back the staff edit + audit row + role changes as one transaction.
- **FR-7** The `EDIT_STAFF_PROFILE` audit event context gains `rolesGranted: Array<{roleId, viaStaffTypeId}>` and `rolesRevoked: Array<{roleId, viaStaffTypeId}>`. Both arrays are empty when the update did not touch roles.
- **FR-8** `UpdateStaffTypeUseCase` does NOT propagate `defaultRoleId` changes to existing `user_roles` rows (D1). Behavior is unchanged from today for that use case.
- **FR-9** `ArchiveStaffUseCase` and `RestoreStaffUseCase` do NOT modify any `user_roles` row (D4). Their current behavior — Clerk lock + `user.isActive` toggle + `staff.isArchived` toggle — is unchanged.
- **FR-10** Migration: a single Prisma migration adds the column + FK + index, sets all existing rows to `NULL`, and is reversible.
- **FR-11** Extend the `TransactionContext.assignRoles` port to accept an optional `grantedViaStaffTypeId` per `RoleAssignmentInput`. Add a new `revokeRolesByProvenance(userId, staffTypeId)` op for the revoke side.

### Non-Functional Requirements

- **NFR-1** No new background jobs, queues, or async processors. All mutations are synchronous within a single UoW.
- **NFR-2** No change to existing role-resolution / permission-checking paths. The new column is write-only for v1.
- **NFR-3** Performance: the revoke path is a single `DELETE WHERE userId = ? AND granted_via_staff_type_id = ?` — bounded by the typical 1 row per staff-type per user. No N+1.

## Acceptance Criteria

- [ ] **AC-1** Prisma migration adds `granted_via_staff_type_id` (nullable, `@db.Uuid`, FK to `staff_type.id`, `onDelete: SetNull`) and a non-unique index on the column.
- [ ] **AC-2** Migration leaves every existing `user_roles.granted_via_staff_type_id` value as `NULL`.
- [ ] **AC-3** `CreateStaff` with `staffTypeId` set and `staffType.defaultRoleId` set inserts a `user_roles` row carrying `granted_via_staff_type_id = staffTypeId`.
- [ ] **AC-4** `CreateStaff` without `staffTypeId` (or with `staffTypeId` whose type has no `defaultRoleId`) inserts no `user_roles` row.
- [ ] **AC-5** `UpdateStaff` changing `staffTypeId` from `A` to `B` (both non-null) deletes `user_roles` rows where `granted_via_staff_type_id = A` AND inserts a row with `granted_via_staff_type_id = B`.
- [ ] **AC-6** `UpdateStaff` changing `staffTypeId` from `A` to `null` deletes rows with provenance `A`; no insert.
- [ ] **AC-7** `UpdateStaff` changing `staffTypeId` from `null` to `A` performs no revoke; inserts one new row with provenance `A`.
- [ ] **AC-8** A `user_roles` row with `granted_via_staff_type_id IS NULL` is never deleted by `UpdateStaff`, even when its `(userId, roleId)` matches the old type's `defaultRoleId`.
- [ ] **AC-9** `EDIT_STAFF_PROFILE` audit context includes `rolesGranted` and `rolesRevoked` arrays; each entry has shape `{roleId, viaStaffTypeId}`.
- [ ] **AC-10** When `UpdateStaff` is called with no role-impacting change, the emitted audit event's `rolesGranted` and `rolesRevoked` are both `[]`.
- [ ] **AC-11** `ArchiveStaffUseCase` and `RestoreStaffUseCase` integration tests confirm no `user_roles` rows are mutated; existing grants persist across archive→restore.
- [ ] **AC-12** `UpdateStaffTypeUseCase` integration test confirms changing `defaultRoleId` does not modify any existing `user_roles` row.
- [ ] **AC-13** When `staff.userId IS NULL`, `UpdateStaff` skips both revoke and assign; no `user_roles` mutations occur and audit arrays are `[]`.
- [ ] **AC-14** Tracked-grant assign trying to insert a row that collides with an existing manual grant (`granted_via_staff_type_id IS NULL`, same `(userId, roleId, campusId)`) leaves the existing row unchanged and emits no error.
- [ ] **AC-15** A simulated DB failure during the role mutation rolls back the entire UoW: no staff change, no audit row, no `user_roles` change.
- [ ] **AC-16** When `staffType.defaultRoleId IS NULL` for the *new* type during an `UpdateStaff` swap, the system still revokes the *old* type's grant but inserts nothing new. `rolesRevoked` populated; `rolesGranted = []`.

## Scenarios

### Scenario 1: Single-type swap (happy path)
**Given** Staff `S` with `userId = U`, `staffTypeId = "teacher"`. `Teacher.defaultRoleId = "ROLE_TEACHER"`. `user_roles` contains `(U, ROLE_TEACHER, campusA, granted_via_staff_type_id = teacher)`.
**When** Admin updates `S` with `staffTypeId = "principal"` (`Principal.defaultRoleId = "ROLE_PRINCIPAL"`).
**Then**
- `user_roles` row `(U, ROLE_TEACHER, campusA, teacher)` is deleted.
- `user_roles` row `(U, ROLE_PRINCIPAL, campusA, principal)` is inserted.
- `EDIT_STAFF_PROFILE` audit event:
  - `beforeValue: { staffTypeId: "teacher" }`
  - `afterValue: { staffTypeId: "principal" }`
  - `context.rolesRevoked: [{ roleId: "ROLE_TEACHER", viaStaffTypeId: "teacher" }]`
  - `context.rolesGranted: [{ roleId: "ROLE_PRINCIPAL", viaStaffTypeId: "principal" }]`

### Scenario 2: Clear `staffTypeId`
**Given** Staff `S` with `staffTypeId = "teacher"`; `user_roles` has a row granted via `teacher`.
**When** Admin updates `S` with `staffTypeId = null`.
**Then** Old row deleted; no new row inserted. Audit: `rolesRevoked = [{ ROLE_TEACHER, teacher }]`, `rolesGranted = []`.

### Scenario 3: Manual override preserved
**Given** Staff `S`, `userId = U`, `staffTypeId = "teacher"`. `user_roles` contains:
- `(U, ROLE_TEACHER, campusA, granted_via_staff_type_id = teacher)`
- `(U, ROLE_ADMIN, campusA, granted_via_staff_type_id = NULL)` — manually granted by admin
**When** Admin updates `S` with `staffTypeId = null`.
**Then** Only the first row is deleted. `(U, ROLE_ADMIN, campusA, NULL)` is preserved. `ROLE_ADMIN` remains active for the user.

### Scenario 4: StaffType.defaultRoleId edit does NOT propagate (D1)
**Given** `StaffType.principal` has `defaultRoleId = "ROLE_PRINCIPAL"`. 5 staff members carry this type, each with a `user_roles` row granted via `principal`.
**When** Admin updates `principal.defaultRoleId = "ROLE_PRINCIPAL_V2"`.
**Then** The 5 existing `user_roles` rows remain unchanged (still grant `ROLE_PRINCIPAL` with provenance `principal`). Any new staff assigned `principal` after this point gets `ROLE_PRINCIPAL_V2`. A future `POST /staff-types/:id/resync` would reconcile (out of scope).

### Scenario 5: Archive does not revoke (D4)
**Given** Staff `S` with an auto-granted `user_roles` row via `teacher`.
**When** Admin archives `S`.
**Then** `staff.isArchived = true`, `user.isActive = false`, Clerk identity locked. The `user_roles` row is untouched. Restoring `S` re-enables Clerk + `isActive`; the user is immediately back with the same role.

### Scenario 6: Staff without `userId`
**Given** Staff `S` with `userId IS NULL` (edge case — Clerk user was deleted; `staff.userId` was set to NULL by FK cascade).
**When** Admin updates `S` with `staffTypeId` change.
**Then** No `user_roles` mutations. `staff.staffTypeId` update succeeds normally. Audit context arrays are both `[]`.

### Scenario 7: Manual grant conflict (D5)
**Given** Admin previously manually granted `(U, ROLE_TEACHER, campusA, granted_via_staff_type_id = NULL)`. Staff `S` (userId=U) has `staffTypeId = null`.
**When** Admin updates `S` with `staffTypeId = "teacher"` (Teacher.defaultRoleId = ROLE_TEACHER, same role).
**Then** The unique-constraint conflict is caught. The existing manual row is preserved unchanged (provenance stays NULL). No new row inserted. Audit context: `rolesGranted = []` (system did not actually grant anything new), `rolesRevoked = []`.

### Scenario 8: Failure rollback
**Given** Staff `S` mid-update inside a UoW transaction. `assignRoles` throws (simulated DB error).
**When** The UoW catches the error.
**Then** The entire transaction rolls back. `staff` is not updated. No new `user_roles` row. No audit row. The use case propagates the error to the caller.

### Scenario 9: New type has no defaultRoleId
**Given** Staff `S` with `staffTypeId = "teacher"` (grants ROLE_TEACHER). `StaffType "intern"` has `defaultRoleId = null`.
**When** Admin updates `S` with `staffTypeId = "intern"`.
**Then** Old row revoked. No new row inserted. Audit: `rolesRevoked = [{ROLE_TEACHER, teacher}]`, `rolesGranted = []`.

## Technical Notes

### Schema delta

```prisma
model UserRole {
  id                    String    @id @default(uuid()) @db.Uuid
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId                String    @map("user_id") @db.Uuid
  role                  Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)
  roleId                String    @map("role_id") @db.Uuid
  campus                Campus?   @relation(fields: [campusId], references: [id], onDelete: Cascade)
  campusId              String?   @map("campus_id") @db.Uuid

  // NEW — null = manual grant (never auto-revoked).
  grantedViaStaffTypeId String?    @map("granted_via_staff_type_id") @db.Uuid
  grantedViaStaffType   StaffType? @relation("UserRoleProvenance", fields: [grantedViaStaffTypeId], references: [id], onDelete: SetNull)

  assignedAt DateTime @default(now()) @map("assigned_at") @db.Timestamptz(6)

  @@unique([userId, roleId, campusId])
  @@index([userId])
  @@index([roleId])
  @@index([campusId])
  @@index([grantedViaStaffTypeId])   // NEW
  @@map("user_roles")
}

// On StaffType, add reverse side:
//   userRoleProvenance UserRole[] @relation("UserRoleProvenance")
```

`onDelete: SetNull` on the FK: if a `StaffType` is hard-deleted, the provenance is cleared, and the grant becomes "orphaned manual" — never auto-revoked. Acceptable since the codebase soft-deletes StaffTypes via `archive()`; hard delete is operationally rare.

### Port surface

`TransactionContext` (`@/application/ports/unit-of-work.port.ts`) gains:

```typescript
assignRoles(
  userId: string,
  roleAssignments: Array<RoleAssignmentInput & { grantedViaStaffTypeId?: string | null }>,
): Promise<void>;

revokeRolesByProvenance(userId: string, grantedViaStaffTypeId: string): Promise<void>;
```

The existing `assignRoles` callers (non-tracked use cases like `AssignRolesToUserUseCase`) pass `grantedViaStaffTypeId: undefined`, which writes NULL — preserving today's behavior. `RoleAssignmentInput` already exists in `@/application/user-management/ports/user.repository`.

### Use-case flow change (`UpdateStaffUseCase`)

Inside the UoW (lines 235-274 and 326-365 — both saga and non-saga paths):

```typescript
const oldStaffTypeId = staff.staffTypeId;          // pre-update value
const newStaffTypeId = input.staffTypeId;          // may be undefined / string / null
const oldDefaultRoleId = await resolveOldDefault(); // pre-resolved before UoW
const newDefaultRoleId = newStaffType?.defaultRoleId ?? null;

// ... existing staff.updateProfile + tx.updateStaff ...

let rolesRevoked: Array<{ roleId, viaStaffTypeId }> = [];
let rolesGranted: Array<{ roleId, viaStaffTypeId }> = [];

if (staff.userId && newStaffTypeId !== undefined && newStaffTypeId !== oldStaffTypeId) {
  if (oldStaffTypeId) {
    await tx.revokeRolesByProvenance(staff.userId, oldStaffTypeId);
    if (oldDefaultRoleId) {
      rolesRevoked.push({ roleId: oldDefaultRoleId, viaStaffTypeId: oldStaffTypeId });
    }
  }
  if (newStaffTypeId && newDefaultRoleId) {
    const inserted = await tx.assignRoles(staff.userId, [
      { roleId: newDefaultRoleId, campusId: staff.campusId, grantedViaStaffTypeId: newStaffTypeId },
    ]);
    // assignRoles returns the count of actual inserts so we can detect D5 (manual-wins) conflicts:
    // if inserted == 0, the conflict path triggered and rolesGranted stays empty.
    if (inserted > 0) {
      rolesGranted.push({ roleId: newDefaultRoleId, viaStaffTypeId: newStaffTypeId });
    }
  }
}

// audit row includes rolesGranted / rolesRevoked in context
```

Pre-resolution of `oldDefaultRoleId` outside the UoW is necessary because the entity-level `staff.changeStaffType()` only mutates the FK, not the related row — and the audit payload needs the role ID we just revoked.

### D5 conflict mechanics (manual-wins)

The unique constraint `@@unique([userId, roleId, campusId])` will throw on a colliding insert. Two clean implementations:

1. **Optimistic** — let the insert throw, catch the Prisma `P2002` error, swallow, leave the existing row alone. Simpler code, one extra round-trip on conflict.
2. **Pre-check** — query before insert: `SELECT … WHERE (userId, roleId, campusId) = (?, ?, ?)`; only insert if not exists.

Recommend optimistic — the conflict is rare (D5 only fires when an admin pre-empted the system), and the Prisma error code is well-defined.

Either way: `assignRoles` should return the count of rows actually inserted so the use case can decide whether to populate `rolesGranted`.

### Audit context shape — addition only

```typescript
// AuditEventContext for EDIT_STAFF_PROFILE — additive, both fields optional & defaulted to [].
type EditStaffProfileContext = {
  actorName: string | null;
  rolesGranted?: Array<{ roleId: string; viaStaffTypeId: string }>;
  rolesRevoked?: Array<{ roleId: string; viaStaffTypeId: string }>;
};
```

The FE registry (`@doc/references/audit-event-context-shapes`) needs a parallel update — the timeline renderer will gain "Granted role X (via Type Y)" / "Revoked role X (via Type Y)" lines beneath the profile-diff renderer when the arrays are non-empty.

### Forward compatibility with `staff-multi-type-refactor`

Two known wrinkles the multi-type spec will inherit and must address — flagged here so they're not surprises:

1. **Provenance + unique constraint interaction in multi-type.** If a staff has `[Teacher, Mentor]` and both types share the same `defaultRoleId`, the unique `(userId, roleId, campusId)` prevents two `user_roles` rows. Only the first type's grant materializes; removing the *other* type would not revoke. The multi-type spec will need to either: (a) drop the unique constraint and allow per-provenance rows, or (b) reference-count via app logic (`revoke only if no remaining held type still grants this role`). This spec does not pre-emptively solve it because the constraint cannot be safely dropped while we're still in single-type mode.
2. **Set-vs-scalar revoke semantics.** Today's revoke is keyed on a single `oldStaffTypeId`. In multi-type, the revoke set is `oldTypeIds \ newTypeIds`. The `revokeRolesByProvenance` port is single-ID; the multi-type spec will either loop it or extend it to accept an array.

### Implementation order (informational, not normative)

1. Prisma migration (additive only — no data movement).
2. Port + repo extension (`assignRoles` accepts provenance; new `revokeRolesByProvenance`).
3. `CreateStaffUseCase` writes provenance on its single auto-grant.
4. `UpdateStaffUseCase` revoke + assign + audit context extension.
5. Audit-event-context-shapes doc update.
6. Tests (unit per use case, integration covering FR/AC matrix).
7. Frontend registry update (separate FE PR, coordinated).

### Out of scope

- `POST /staff-types/:id/resync` admin endpoint (the deferred companion to D1).
- Multi-type support on `Staff` (separate spec).
- Backfilling provenance on existing rows by inference (rejected — D2).
- Audit events for non-staff-driven role assignments (e.g., `AssignRolesToUserUseCase` direct-grant via the user-management API).

## Open Questions

None — all gray areas resolved during exploration.

## Follow-up Tasks

- **`staff-type-resync-endpoint`** — Add `POST /staff-types/:id/resync` that, for the given type, finds `user_roles` rows where `granted_via_staff_type_id = :id` AND `role_id != currentDefaultRoleId`, then revokes and re-assigns to match current config. Admin-triggered; emits a `RESYNC_STAFF_TYPE_ROLES` audit event. Pre-condition for D1's "decoupled now, propagation later" to be reachable.
- **`staff-multi-type-refactor`** — The original feature this spec unblocks. Becomes mostly a data-shape change once tracked-grant primitives exist.
