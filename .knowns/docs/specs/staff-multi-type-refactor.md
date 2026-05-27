---
title: Staff Multi-Type Refactor
description: 'Backend refactor that replaces the single `Staff.staffTypeId` scalar with a `staff_staff_type` junction table so a staff member can hold 1..N concurrent staff types. Switches role-grant provenance from single-type to set-diff per swap, widens the user_roles unique key to four columns with NULLS NOT DISTINCT to allow multiple tracked rows + a single manual row per (user, role, campus), and retires D5 of tracked-grant-revocation (manual-wins). Ships atomically with the FE in a single coordinated release.'
createdAt: '2026-05-27T02:26:24.549Z'
updatedAt: '2026-05-27T02:30:45.789Z'
tags:
  - spec
  - approved
  - backend
  - user-management
  - rbac
  - schema-change
  - audit
---

## Overview

The current data model enforces 0..1 staff-type per staff (`Staff.staffTypeId: String?`). Product requires 0..N (in practice 1..N at write time) so a single staff can hold concurrent types — the named driver is a person who is both a Teacher and the Vice President at the same campus.

This spec introduces a `staff_staff_type` join table, drops `staff.staff_type_id`, replaces the use-case-level "single-type swap" role-grant logic with a set-diff (added vs removed), widens the `user_roles` unique key from 3 columns to 4 (provenance becomes part of the key) using PostgreSQL `NULLS NOT DISTINCT` so a single manual row + many tracked rows can coexist per `(user, role, campus)`. The change ships in one coordinated release with the frontend — no compat window.

Prerequisite: @doc/specs/tracked-grant-revocation (shipped). FE consumer brief: @doc/references/staff-multi-type-backend-handoff. Constraint surface: @doc/architecture/rbac-system. Audit shape: @doc/references/audit-event-context-shapes.

## Locked Decisions

- **D1** — Response wire shape: `staffTypes: StaffTypeSummaryDto[]` (nested `{id, name}` summaries), sorted by `StaffType.order ASC`. The previous `staffTypeId` and `staffType` fields are removed.
- **D2** — `user_roles` unique constraint becomes `(userId, roleId, campusId, grantedViaStaffTypeId)` with `NULLS NOT DISTINCT`. Multiple tracked rows can coexist for the same `(user, role, campus)`; a single manual row (provenance NULL) can also coexist. D5 of @doc/specs/tracked-grant-revocation (manual-wins) **retires** under this model — there is no conflict to suppress.
- **D3** — No cap on the number of types per staff. The join table's `@@id([staffId, staffTypeId])` is the only DB-side uniqueness; the FE handles display overflow with a `+N more` pill.
- **D4** — Minimum 1 staff type required at write time. Enforced at the DTO (`@ArrayMinSize(1)`) AND at the entity (`setStaffTypes` invariant). Factory `Staff.create` accepts empty arrays so the mapper can hydrate legacy migrated rows.
- **D5** — Forward migration: backfill `staff_staff_type` from `staff WHERE staff_type_id IS NOT NULL`, then drop `staff.staff_type_id`. Legacy staff with `staff_type_id IS NULL` migrate to zero join rows — the next edit forces the operator to pick a type. No sentinel "Unassigned" type.
- **D6** — Atomic switch deploy. BE response shape and FE consumers ship in one coordinated release. Mobile is not a `/staff` consumer today (per FE handoff). No compat window or dual-emit.
- **D7** — Bulk staff endpoints out of scope. None exist today; none are added by this spec. Single-row `POST/PATCH /staff` writes carry the multi-type payload.
- **D-extra-1** — Audit `before_value.staffTypeIds` / `after_value.staffTypeIds` are sorted by UUID lex ASC at write time. `StaffType.order` is mutable; UUID is stable across reorders, so the audit row never lies retroactively. The FE re-sorts by `order` at display time.
- **D-extra-2** — `tx.revokeRolesByProvenance` signature widens from `(userId, grantedViaStaffTypeId: string)` to `(userId, grantedViaStaffTypeIds: string[])`. One SQL round-trip per swap.
- **D-extra-3** — Per-provenance row materialization. When two staff types in the input set share the same `defaultRoleId`, both produce a `user_roles` row (one per provenance). Auth-layer set-union dedupes by role for permission resolution; list-role endpoints dedupe by `roleId` at response time. Two rows for the same `(user, role, campus)` is a valid steady state.

## Requirements

### Functional Requirements

- **FR-1** — Schema: a new `staff_staff_type` table replaces the scalar `staff.staff_type_id` column. PK `(staff_id, staff_type_id)`; FK to `staff` with `ON DELETE CASCADE`; FK to `staff_type` with `ON DELETE RESTRICT`; index on `staff_type_id`; `created_at` `Timestamptz(6)` default `now()`.
- **FR-2** — `user_roles` unique constraint changes from `(userId, roleId, campusId)` to `(userId, roleId, campusId, grantedViaStaffTypeId)` with `NULLS NOT DISTINCT` applied via raw SQL in the migration (Prisma's `@@unique` attribute does not express `NULLS NOT DISTINCT` directly).
- **FR-3** — `POST /staff` accepts `staffTypeIds: string[]` with `@ArrayMinSize(1)`, all UUIDs, all existing + not-archived + same campus as the request. The use case inserts one `staff_staff_type` row per type and one `user_roles` tracked row per type-with-non-null-`defaultRoleId`.
- **FR-4** — `PATCH /staff/:id` accepts optional `staffTypeIds: string[]`. When present, semantics are full-set replacement (PUT-like): the server computes `added = newSet \ oldSet` and `removed = oldSet \ newSet`, then applies the diff atomically.
- **FR-5** — Single-row response (`GET /staff/:id`, `GET /staff`, `POST /staff`, `PATCH /staff/:id`) emits `staffTypes: StaffTypeSummaryDto[]` sorted by `StaffType.order ASC`. `staffTypeId` and `staffType` are removed from the response shape.
- **FR-6** — List filter on `GET /staff` switches from `?filter[staffTypeId]=X` to `?filter[staffTypeIds]={"in":["A","B"]}` with `some`-semantics ("staff who holds any of the listed types"). Implemented at the repository layer via pre-extraction from `params.filterInfo.filters` and injection into `options.where` as `staffTypes: { some: { staffTypeId: { in: [...] } } }`. `staffTypeIds` is NOT added to `allowedFilterFields` — the standard query service is flat-field-only and cannot express relation traversal.
- **FR-7** — `StaffRepository.findByStaffTypeId(staffTypeId)` retains its signature; semantics change from "staff whose single type is X" to "staff who holds X among their types" (Prisma `where: { staffTypes: { some: { staffTypeId } } }`).
- **FR-8** — `StaffRepository.findEligibleForClass` is unaffected on the where-clause (no staff-type filter today). Eager-load shape switches to `include: { staffTypes: { include: { staffType: true } } }`.
- **FR-9** — `ClassStaffStaffInfo` in @doc/references/audit-event-context-shapes consumers and `src/infra/http/dtos/class-management/class-staff.response.ts` replaces `staffType: StaffTypeSummaryDto | null` with `staffTypes: StaffTypeSummaryDto[]` (same sort as FR-5).
- **FR-10** — `EDIT_STAFF_PROFILE` audit diff field set changes: `pickStaffAuditFields` replaces `staffTypeId` with `staffTypeIds: string[]` (sorted UUID lex ASC). `context.rolesGranted` and `context.rolesRevoked` shapes are unchanged — they were already arrays of `{ roleId, viaStaffTypeId }`; multi-entry becomes the norm.
- **FR-11** — `tx.revokeRolesByProvenance(userId: string, grantedViaStaffTypeIds: string[])` replaces the single-ID overload. Implementation: `tx.userRole.deleteMany({ where: { userId, grantedViaStaffTypeId: { in: grantedViaStaffTypeIds } } })`. Returns row-count.
- **FR-12** — A new `tx.replaceStaffTypes(staffId: string, staffTypeIds: string[]): Promise<void>` UoW method handles full-set replacement of the join table inside the active transaction. Implementation: `deleteMany({ where: { staffId } })` followed by `createMany({ data: [...] })`.
- **FR-13** — `UpdateStaffUseCase.syncTrackedGrants` is rewritten around the added/removed set diff. The `if (inserted > 0)` guard on `rolesGranted.push(...)` from @doc/specs/tracked-grant-revocation is removed — D5 retirement means every tracked insert succeeds against a real type (defensive `skipDuplicates` survives but is no longer load-bearing).
- **FR-14** — `CreateStaffUseCase` accepts `staffTypeIds: string[]` and inserts per-type tracked grants. Two types sharing the same `defaultRoleId` produce two `user_roles` rows.
- **FR-15** — @doc/specs/tracked-grant-revocation gains a `## Superseded` note on its D5 (manual-wins), pointing to this spec as the supersedent.
- **FR-16** — @doc/references/audit-event-context-shapes section `EDIT_STAFF_PROFILE` updates to replace `staffTypeId` (scalar) with `staffTypeIds` (sorted UUID array) in the `before_value`/`after_value` field list.

### Non-Functional Requirements

- **NFR-1** — Atomic switch deploy: BE response shape and FE consumers release together. No dual-emit, no compat window.
- **NFR-2** — One round-trip per swap. `tx.revokeRolesByProvenance` and `tx.assignRoles` are each one SQL statement; `tx.replaceStaffTypes` is two (delete + createMany).
- **NFR-3** — No artificial cap on types per staff (D3 unlimited). The join table PK and the use case enforce uniqueness; FE handles display overflow.
- **NFR-4** — Audit history immutability. `before_value`/`after_value.staffTypeIds` are pre-sorted by UUID lex at write time and never re-sorted by the renderer.

## Acceptance Criteria

- [ ] AC-1: Single Prisma migration adds `staff_staff_type` table (PK `(staff_id, staff_type_id)`, FK staff `ON DELETE CASCADE`, FK staff_type `ON DELETE RESTRICT`, `@@index([staffTypeId])`, `@@map("staff_staff_type")`), drops `staff.staff_type_id` column + its FK + auto-named index, and replaces the 3-col `user_roles` unique with a 4-col `NULLS NOT DISTINCT` unique via raw SQL.
- [ ] AC-2: The same migration backfills `staff_staff_type` with one row per `staff WHERE staff_type_id IS NOT NULL` (copies `created_at` from `staff`). Legacy staff with `staff_type_id IS NULL` migrate to zero join rows.
- [ ] AC-3: `Staff` entity replaces `staffTypeId: string | null` + `staffType: StaffTypeSnapshot | null` with `staffTypes: StaffTypeSnapshot[]`. Methods `changeStaffType` and `hasStaffType` are removed; a new `setStaffTypes(snapshots: StaffTypeSnapshot[])` method enforces `min 1` invariant. Factory `Staff.create` continues to accept empty `staffTypes` for mapper hydration of legacy rows.
- [ ] AC-4: `prisma-staff.mapper.ts` walks the loaded `staffTypes` collection, projects each `staffType` to `{ id, name }`, sorts by `StaffType.order` ASC, and produces `staffTypes: StaffTypeSnapshot[]` on the domain entity. `toPrisma` and `toPrismaUpdate` no longer write `staffTypeId` (Staff scalar gone); join writes go through `tx.replaceStaffTypes`, not the mapper.
- [ ] AC-5: Every `findBy*` and `findAll` in `prisma-staff.repository.ts` switches eager-load to `include: { staffTypes: { include: { staffType: true } } }`. `findByStaffTypeId` becomes `where: { staffTypes: { some: { staffTypeId } } }`. `findAll` pre-extracts `staffTypeIds` from `params.filterInfo.filters` before delegating to `executeQuery` and merges a `staffTypes: { some: { staffTypeId: { in: [...] } } }` clause into `options.where`. `staffTypeIds` does not appear in `allowedFilterFields`.
- [ ] AC-6: `StaffResponse` removes `staffTypeId` and `staffType`; adds `staffTypes: StaffTypeSummaryDto[]` with `@Type(() => StaffTypeSummaryDto)` and `@Expose()`.
- [ ] AC-7: `CreateStaffRequest` replaces `staffTypeId?: string` with `staffTypeIds: string[]` validated by `@IsArray()`, `@ArrayMinSize(1)`, `@IsUUID('4', { each: true })`. No `@ArrayMaxSize`.
- [ ] AC-8: `UpdateStaffRequest` replaces `staffTypeId?: string | null` with `staffTypeIds?: string[]` validated as in AC-7 when present.
- [ ] AC-9: `ClassStaffStaffInfo.staffType` is replaced with `staffTypes: StaffTypeSummaryDto[]` (sort by `StaffType.order ASC`).
- [ ] AC-10: `TransactionContext.replaceStaffTypes(staffId, staffTypeIds: string[]): Promise<void>` is added and implemented in `staff.transaction-ops.ts` as `deleteMany + createMany` against the active tx client.
- [ ] AC-11: `TransactionContext.revokeRolesByProvenance` signature changes to `(userId, grantedViaStaffTypeIds: string[]): Promise<number>`. The single-ID overload is removed; the only existing caller in `UpdateStaffUseCase` migrates.
- [ ] AC-12: `UpdateStaffUseCase.syncTrackedGrants` is rewritten around set-diff. Pre-resolves removed-type `defaultRoleId`s (for audit) and added-type `defaultRoleId`s (for assignment) BEFORE entering the UoW. Inside the UoW: calls `tx.replaceStaffTypes`, `tx.revokeRolesByProvenance(userId, removed)` when `removed` is non-empty, and `tx.assignRoles(userId, [...])` with one entry per `(added type, defaultRoleId, provenance)` triple. `rolesRevoked` includes each removed type whose pre-resolved `defaultRoleId` is non-null. `rolesGranted` always populated on insert success (count guard removed).
- [ ] AC-13: `CreateStaffUseCase` accepts `staffTypeIds: string[]` (min 1, validated upstream). Inside the UoW: writes `tx.replaceStaffTypes(staffEntity.id, staffTypeIds)` (or equivalent `createMany` if the type set is known at create time), then for each type with a non-null `defaultRoleId` inserts a `user_roles` row via `tx.assignRoles` with per-type provenance. Two types sharing the same `defaultRoleId` produce two rows.
- [ ] AC-14: `pickStaffAuditFields` in `update-staff.use-case.ts` swaps `staffTypeId` for `staffTypeIds: string[]` (sorted UUID lex ASC). `before_value`/`after_value` reflect the array shape via `computeDiff`'s existing JSON-fallback path (arrays compared by stringified equality — pre-sort guarantees no false diff).
- [ ] AC-15: @doc/references/audit-event-context-shapes section `EDIT_STAFF_PROFILE` updates its `before_value`/`after_value` field-list to list `staffTypeIds` (array) instead of `staffTypeId`, and documents the UUID-lex ASC sort.
- [ ] AC-16: @doc/specs/tracked-grant-revocation gains a `## Superseded sections` block explicitly retiring D5 (manual-wins) and pointing to this spec, with a brief note on why the conflict path no longer exists under the 4-col unique key.
- [ ] AC-17: `mock-repository-factory.ts` and `entity-factories.ts` updated. The staff factory accepts a `staffTypes: StaffTypeSnapshot[]` parameter (defaults to `[]` for legacy callers); `findByStaffTypeId` mock returns staff matching via the `some` semantic.
- [ ] AC-18: Existing test suites updated and extended: `staff.entity.spec.ts`, `prisma-staff.mapper.spec.ts`, `create-staff.use-case.spec.ts`, `update-staff.use-case.spec.ts`, `update-staff-tracked-grant.integration.spec.ts`, plus new repository-level tests for the FR-6 filter pre-extraction.

## Scenarios

### Scenario 1: Create staff with two types sharing the same default role

**Given** StaffType-Teacher (`defaultRoleId = ROLE_STAFF`) and StaffType-VicePresident (`defaultRoleId = ROLE_STAFF`) both exist and are active in campus C.
**When** `POST /staff` with `staffTypeIds: [Teacher.id, VicePresident.id]` and other valid fields.
**Then** response includes `staffTypes` with both summaries sorted by `StaffType.order ASC`. `staff_staff_type` contains two rows. `user_roles` contains two rows for `(user, ROLE_STAFF, C)`: one with `grantedViaStaffTypeId = Teacher.id`, one with `grantedViaStaffTypeId = VicePresident.id`. Permission resolution (set-union by role) treats the user as holding `ROLE_STAFF` once. `CREATE_STAFF` audit event emitted as before.

### Scenario 2: PATCH staff — add one type, remove one type (happy path)

**Given** a staff with `staffTypes = [Teacher, Nurse]` linked to a user, where Teacher and Nurse each have a non-null `defaultRoleId`. Two tracked `user_roles` rows exist (one per type).
**When** `PATCH /staff/:id` with `staffTypeIds: [Teacher.id, VicePresident.id]` (Nurse removed, VicePresident added).
**Then** inside one UoW: `tx.replaceStaffTypes` deletes the Nurse link and inserts a VicePresident link (Teacher link unchanged via delete-then-recreate); `tx.revokeRolesByProvenance(userId, [Nurse.id])` removes the Nurse-provenance `user_roles` row; `tx.assignRoles(userId, [{ roleId: VicePresident.defaultRoleId, campusId: C, grantedViaStaffTypeId: VicePresident.id }])` inserts the VicePresident grant. Audit `rolesRevoked = [{ roleId: Nurse.defaultRoleId, viaStaffTypeId: Nurse.id }]`, `rolesGranted = [{ roleId: VicePresident.defaultRoleId, viaStaffTypeId: VicePresident.id }]`. `before_value.staffTypeIds` and `after_value.staffTypeIds` are UUID-lex sorted arrays.

### Scenario 3: PATCH staff with the same set — no-op audit

**Given** a staff with `staffTypes = [Teacher, VicePresident]`.
**When** `PATCH /staff/:id` with `staffTypeIds: [VicePresident.id, Teacher.id]` (identical set, different order).
**Then** set-diff yields `added = [], removed = []`. `tx.replaceStaffTypes` is still called (delete-then-recreate is idempotent at the table level). No `tx.revokeRolesByProvenance` or `tx.assignRoles` call. `rolesGranted = [], rolesRevoked = []`. `computeDiff` sees identical UUID-lex-sorted arrays for `staffTypeIds` → no diff entry → no `EDIT_STAFF_PROFILE` audit event emitted (existing zero-diff suppression).

### Scenario 4: Manual grant + tracked grant coexist (D5 retirement in action)

**Given** an admin manually granted `ROLE_X` to user U in campus C (provenance NULL).
**When** user U is later linked to a new staff record with `staffTypeIds: [SomeType.id]` where `SomeType.defaultRoleId = ROLE_X`.
**Then** the manual `user_roles` row (provenance NULL) is preserved unchanged. A second row is inserted for `(U, ROLE_X, C, SomeType.id)` — the 4-col unique with `NULLS NOT DISTINCT` treats `(..., NULL)` and `(..., SomeType.id)` as distinct. Permission resolution dedupes by role → user holds `ROLE_X` once. Audit `rolesGranted = [{ roleId: ROLE_X, viaStaffTypeId: SomeType.id }]` (always populated under D5 retirement).

### Scenario 5: Two manual grants would still collide

**Given** an admin manually granted `ROLE_Y` to user U in campus C (provenance NULL).
**When** another admin attempts a manual grant of `ROLE_Y` to U in C again (also provenance NULL).
**Then** `NULLS NOT DISTINCT` treats both inputs as colliding on `(U, ROLE_Y, C, NULL)`. Prisma `skipDuplicates: true` suppresses the conflict; one row exists; `assignRoles` returns count = 0 for the duplicate. (Behavior identical to today's 3-col unique under the existing manual-grant path.)

### Scenario 6: Migrate legacy staff with NULL staff_type_id

**Given** a staff row with `staff.staff_type_id IS NULL` exists in production at migration time.
**When** the migration runs.
**Then** zero rows are inserted into `staff_staff_type` for this staff. Reads emit `staffTypes: []`. A subsequent `PATCH /staff/:id` that omits `staffTypeIds` succeeds (other fields can be updated). A `PATCH` with `staffTypeIds: []` is rejected with `400` ("at least one staff type is required"). A `PATCH` with `staffTypeIds: [SomeType.id]` succeeds and re-establishes the new invariant for this row.

### Scenario 7: Staff without a linked user account

**Given** a staff with `userId IS NULL`.
**When** `PATCH /staff/:id` with any `staffTypeIds` change.
**Then** `tx.replaceStaffTypes` writes the join rows; `syncTrackedGrants` returns early with empty `rolesGranted`/`rolesRevoked` arrays (no userId → no `user_roles` to manage). Audit emits with non-empty `staffTypeIds` diff in `before_value`/`after_value` and empty role arrays.

### Scenario 8: UoW rollback on partial failure

**Given** a staff with `staffTypes = [A, B]` and the update attempts to add a type C whose `defaultRoleId` points to a deleted role (defensive case from `update-staff.use-case.ts:511-517` today).
**When** `tx.assignRoles` for C fails inside the UoW.
**Then** the entire transaction rolls back: `staff_staff_type` reverts to `[A, B]`, `user_roles` unchanged, `audit_event` row not written. Client receives the use case's error response; no partial state on disk.

### Scenario 9: Filter list endpoint by multi-type-some

**Given** staff Alice has `[Teacher]`, Bob has `[Teacher, Nurse]`, Carol has `[Nurse]`, Dave has `[]` (legacy orphan).
**When** `GET /staff?filter={"staffTypeIds":{"in":["Teacher.id","Nurse.id"]}}`.
**Then** result includes Alice, Bob, Carol. Dave is excluded. The repository pre-extracted `staffTypeIds` from `params.filterInfo.filters`, removed it from the filter envelope so the validator doesn't reject it (`staffTypeIds` is not in `allowedFilterFields`), and injected `staffTypes: { some: { staffTypeId: { in: [Teacher.id, Nurse.id] } } }` into `options.where`.

## Technical Notes

### Schema delta

```prisma
model Staff {
  // existing scalars unchanged …
  // REMOVE:
  //   staffTypeId String?    @map("staff_type_id") @db.Uuid
  //   staffType   StaffType? @relation(fields: [staffTypeId], references: [id], onDelete: SetNull)
  //   @@index([staffTypeId])

  // ADD:
  staffTypes  StaffStaffType[]
  // … other relations unchanged
}

model StaffType {
  // existing fields unchanged …
  // CHANGE: `staff Staff[]` → `staff StaffStaffType[]`
  staff       StaffStaffType[]
  // userRoleProvenance relation unchanged
}

model StaffStaffType {
  staff       Staff      @relation(fields: [staffId], references: [id], onDelete: Cascade)
  staffId     String     @map("staff_id") @db.Uuid
  staffType   StaffType  @relation(fields: [staffTypeId], references: [id], onDelete: Restrict)
  staffTypeId String     @map("staff_type_id") @db.Uuid

  createdAt   DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)

  @@id([staffId, staffTypeId])
  @@index([staffTypeId])
  @@map("staff_staff_type")
}

model UserRole {
  // existing fields unchanged …

  // CHANGE the unique:
  //   OLD: @@unique([userId, roleId, campusId])
  //   NEW: @@unique([userId, roleId, campusId, grantedViaStaffTypeId])
  //        with NULLS NOT DISTINCT applied via raw SQL (Prisma's @@unique
  //        attribute does not express NULLS NOT DISTINCT directly).
}
```

`onDelete: Restrict` on `StaffStaffType → StaffType` mirrors the existing `Campus → StaffType` convention — hard-deleting a StaffType while staff still hold it is an operational mistake. `StaffType.archive()` is the production removal path. `onDelete: Cascade` on the Staff side is the standard join-table convention — hard-deleting a staff cleans up its links.

### Migration steps (single migration directory)

1. `CREATE TABLE staff_staff_type` per the schema delta.
2. Backfill in the same migration:
   ```sql
   INSERT INTO staff_staff_type (staff_id, staff_type_id, created_at)
   SELECT id, staff_type_id, created_at
   FROM staff
   WHERE staff_type_id IS NOT NULL;
   ```
3. `ALTER TABLE staff DROP COLUMN staff_type_id;` — Postgres cascades the FK and the auto-named index.
4. Drop the existing 3-col unique on `user_roles` (constraint name from the @doc/specs/tracked-grant-revocation migration directory).
5. `CREATE UNIQUE INDEX user_roles_natural_key ON user_roles (user_id, role_id, campus_id, granted_via_staff_type_id) NULLS NOT DISTINCT;` — Postgres 15+ syntax.

Prisma's introspection-then-migrate flow may not produce step 4-5 automatically; expect to write them as raw SQL inside the generated migration file.

### Repository filter pre-extraction (FR-6)

```typescript
// Inside PrismaStaffRepository.findAll, before delegating to executeQuery
const filters = { ...(params.filterInfo?.filters ?? {}) };
const staffTypeIdsFilter = filters.staffTypeIds;
delete filters.staffTypeIds;            // remove so validator doesn't reject

const ids = staffTypeIdsFilter
  ? extractIn(staffTypeIdsFilter)       // accepts { in: [...] } or [...]
  : null;

params.filterInfo = { filters };        // mutate sanitized envelope

const relationWhere = ids && ids.length > 0
  ? { staffTypes: { some: { staffTypeId: { in: ids } } } }
  : {};

return this.queryService.executeQuery(this.prisma, "staff", params, {
  where: relationWhere,                  // merges with options.scope last-wins
  include: { user: true, staffTypes: { include: { staffType: true } } },
  scope,
}, PrismaStaffMapper);
```

Pattern mirrors `findEligibleForClass`'s injected `classes: { none: { classId } }` clause.

### Mapper collection walk

```typescript
const sortedJoins = (prismaStaff.staffTypes ?? [])
  .filter(j => j.staffType !== null)
  .sort((a, b) => (a.staffType!.order ?? 0) - (b.staffType!.order ?? 0));

const staffTypes: StaffTypeSnapshot[] = sortedJoins.map(j => ({
  id: j.staffType!.id,
  name: j.staffType!.name,
}));
```

### Use-case set-diff (illustrative)

```typescript
const oldIds = new Set(staff.staffTypes.map(t => t.id));
const newIds = new Set(input.staffTypeIds);

const added   = [...newIds].filter(id => !oldIds.has(id));
const removed = [...oldIds].filter(id => !newIds.has(id));

// Pre-resolve outside the UoW:
const addedDefaultRoleIds   = await fetchDefaultRoles(added);    // Map<typeId, roleId | null>
const removedDefaultRoleIds = await fetchDefaultRoles(removed);  // same shape; for audit

await this.unitOfWork.run(async (tx) => {
  await tx.updateStaff(staff.id, { /* scalar updates */ });
  await tx.replaceStaffTypes(staff.id, input.staffTypeIds);

  let rolesRevoked: RoleProvenanceEntry[] = [];
  let rolesGranted: RoleProvenanceEntry[] = [];

  if (staff.userId) {
    if (removed.length > 0) {
      await tx.revokeRolesByProvenance(staff.userId, removed);
      rolesRevoked = removed
        .map(typeId => ({ roleId: removedDefaultRoleIds.get(typeId), viaStaffTypeId: typeId }))
        .filter(e => e.roleId);
    }
    if (added.length > 0) {
      const assignments = added
        .map(typeId => ({
          roleId: addedDefaultRoleIds.get(typeId),
          campusId: staff.campusId,
          grantedViaStaffTypeId: typeId,
        }))
        .filter(a => a.roleId);
      if (assignments.length > 0) {
        await tx.assignRoles(staff.userId, assignments);
        rolesGranted = assignments.map(a => ({ roleId: a.roleId!, viaStaffTypeId: a.grantedViaStaffTypeId! }));
      }
    }
  }

  // audit emission as before, with rolesGranted / rolesRevoked populated
});
```

The `if (inserted > 0)` guard from @doc/specs/tracked-grant-revocation's `syncTrackedGrants` is gone — D5 retired.

### Forward compatibility with `tracked-grant-revocation`

D5 (manual-wins) of @doc/specs/tracked-grant-revocation is **retired** by this spec. Under the 4-col unique key with `NULLS NOT DISTINCT`:

- A manual row (provenance NULL) and a tracked row (provenance non-NULL) for the same `(user, role, campus)` are distinct under the new unique key and both can exist.
- Two tracked rows from different staff types are distinct and both can exist.
- Two manual rows for the same `(user, role, campus, NULL)` still collide (one survives, idempotent insert).
- The "tracked insert was suppressed because manual exists" path no longer fires from this codebase's writes.

Concrete code deltas at the use-case layer:
- `UpdateStaffUseCase.syncTrackedGrants` removes the `if (inserted > 0)` guard.
- `tx.assignRoles`'s `count` return value remains documented for legacy callers but is no longer load-bearing.
- `CreateStaffUseCase` continues to write tracked rows.

`tracked-grant-revocation` gets a `## Superseded sections` block per AC-16.

### Out of scope

- `StaffType.defaultRoleId` propagation when a `StaffType` is edited (deferred per D1 of @doc/specs/tracked-grant-revocation; tracked separately as a future `POST /staff-types/:id/resync` endpoint).
- Archive/restore mutating `user_roles` (deferred per D4 of @doc/specs/tracked-grant-revocation; staff archive does not auto-revoke).
- A `primaryStaffTypeId` concept on Staff. Order in the response derives from `StaffType.order` ASC.
- Per-type permission overrides ("Teacher's role at Campus A is X, but at Campus B is Y"). Campus scoping already handles multi-campus.
- Combinator filters ("staff who hold BOTH Teacher AND VicePresident"). `some` semantics is enough for v1.
- Bulk staff create/update endpoints. None exist today; none added by this spec.
- A dedupe-by-roleId change to permission-resolution code paths. Set-union already handles dedup; no functional regression. NFR-4 documents the invariant.
- Mobile-app shape coordination. Per FE handoff, mobile is not a consumer of `/staff` today.

## Open Questions

- [ ] None at spec time. Anything new surfaced during planning should be added here before implementation begins.
