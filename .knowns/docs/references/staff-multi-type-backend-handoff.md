---
title: Staff Multi-Type — Frontend Brief for Backend
description: 'Frontend-authored brief for the backend dev who will own @doc/specs/staff-multi-type-refactor (the follow-up flagged by @doc/specs/tracked-grant-revocation). Captures the business driver, every wire/UI surface that currently assumes a single staffTypeId, the two pre-flagged wrinkles from the tracked-grant spec, the recommended schema/DTO shape FE wants to consume, and the decisions the backend dev needs to lock before the FE can start. Not a spec — input to one.'
createdAt: '2026-05-26T00:00:00.000Z'
updatedAt: '2026-05-26T00:00:00.000Z'
tags:
  - reference
  - handoff
  - backend
  - frontend
  - user-management
  - rbac
  - schema-change
---

# Staff Multi-Type — Frontend Brief for Backend

## Purpose

Frontend-authored brief for the backend dev who will own the `staff-multi-type-refactor` spec (already flagged as the natural follow-up to `@doc/specs/tracked-grant-revocation`). This is **not** a spec — it is FE's input into one. The backend dev should treat the wire shape, DTO field names, and decision questions in this document as proposals to refine in their own spec.

The frontend team is the consumer of whatever shape the backend ships. We have:

- Inventoried every place the FE assumes a single `staffTypeId` (see "FE surfaces affected" below).
- Identified the two load-bearing schema decisions already pre-flagged by the tracked-grant spec.
- Recommended a wire shape that lets the FE finish in one cut rather than two.

Read alongside:

- `@doc/specs/tracked-grant-revocation` — the prerequisite. Already shipped. Already names this refactor as its dependent and identifies the two wrinkles.
- `@doc/architecture/rbac-system` — the constraint surface.
- `@doc/references/audit-event-context-shapes#EDIT_STAFF_PROFILE` — the audit row already uses arrays for `rolesGranted/rolesRevoked`, so it absorbs multi-type emission with zero shape change.

## Business Driver

> A staff member can hold multiple types simultaneously. Example given by product: a person who is both a **Teacher** and the **Vice President** at the same campus.

Today the model enforces 0..1 type per staff. The product wants 0..N (in practice probably 1..N, capped at something small — see Decision 3 below).

This is not a multi-role-per-class request — that is already supported via multiple `class_staff` rows. This is multi-type-per-staff at the user-management layer, which drives role assignment via `StaffType.defaultRoleId`.

## Current State (single-type) — Confirmed Inventory

### Backend

- `prisma/schema.prisma:338-377` — `Staff.staffTypeId String?` nullable scalar FK with `@@index([staffTypeId])`. No join table.
- `src/domain/user-management/entities/staff.entity.ts` — `StaffProps.staffTypeId: string | null` + `staffType: StaffTypeSnapshot | null`. Methods `changeStaffType(id)`, `hasStaffType()`.
- `src/infra/http/dtos/user-management/staff/staff.response.ts` — `staffTypeId: string | null` + single nested `staffType: StaffTypeSummaryDto | null`.
- `src/application/user-management/use-cases/staff/{create,update}-staff.use-case.ts` — accept a single `staffTypeId`; `UpdateStaff` already integrates tracked-grant revoke/assign keyed on a single old→new type swap.
- `src/infra/persistence/prisma/repositories/prisma-staff.repository.ts`:
  - `findAll` allow-list includes `staffTypeId` as a filter field.
  - `findByStaffTypeId(staffTypeId)` returns all staff with that single type.
  - `findEligibleForClass` does **not** filter on type — unaffected.
- `src/infra/persistence/prisma/mapper/prisma-staff.mapper.ts` — maps the single relation; will need to walk a join-table collection.
- `user_roles.granted_via_staff_type_id` (from tracked-grant-revocation) — single nullable FK; this is the constraint that drives the two wrinkles below.

### Frontend

- `src/features/staff/types.ts:18` — `StaffDTO.staffTypeId: string` (non-nullable on the FE — mild drift from backend `string | null`, irrelevant under multi-type since it'll be replaced).
- `src/features/staff/components/staff-dialog.tsx:42,396-418` — Zod `staffTypeId: z.string().min(1)` + a single `SelectField`. Required field today.
- `src/features/staff/components/staff-table.tsx`:
  - `FILTER_CONFIGS` has `{ id: "staffTypeId", isMulti: true }` — the multi-select is the **filter** ("show staff whose type is one of [A, B]"), not the per-row multi-type display.
  - Role column at line 317 reads `row.original.staffTypeId` and renders a single `<Badge>`.
  - `getRoleBadgeClass(type)` is keyed on `StaffTypeDTO.order` for stable color — extends naturally to N chips.
- `src/features/staff/components/profile/info-tab.tsx:160-165` — single "Role" `InfoPair` rendering `staffType?.name`.
- `src/features/staff/components/profile/staff-profile-hero.tsx` — single chip.
- `src/features/classes/components/profile/class-profile-staff-tab.tsx` — displays each staff's single type.
- `src/features/classes/components/bulk-staff-assignment-wizard/source-pane.tsx` — eligible-staff row shows `staff.staffType?.name ?? "Unknown"`.

### Audit (already array-shaped — bonus)

- `EDIT_STAFF_PROFILE.context.rolesGranted: Array<{roleId, viaStaffTypeId}>` and `.rolesRevoked: Array<{roleId, viaStaffTypeId}>` already exist (`@doc/references/audit-event-context-shapes`). They were sized for v1's single grant/revoke but the shape is forward-compatible — under multi-type these become multi-entry arrays naturally, no shape change required.
- `EDIT_STAFF_PROFILE` `before_value` / `after_value` currently diff `staffTypeId` as a scalar. Will need to diff `staffTypeIds` as a sorted array under the new model. The `computeDiff` helper at `src/application/audit/utils/compute-diff.ts` already has a JSON fallback path; backend dev to verify it handles array-as-leaf cleanly or extend it.

## Recommended Target Shape (FE-preferred)

> Backend dev is free to deviate — these are FE's preferences, not requirements. Where deviation costs FE work, the cost is called out.

### Schema delta

A junction table, **not** a `text[]` array column. Rationale: relational integrity, indexable for "who holds type X" queries, plays well with Prisma includes.

```prisma
model StaffStaffType {
  staff       Staff     @relation(fields: [staffId], references: [id], onDelete: Cascade)
  staffId     String    @map("staff_id") @db.Uuid
  staffType   StaffType @relation(fields: [staffTypeId], references: [id], onDelete: Restrict)
  staffTypeId String    @map("staff_type_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  @@id([staffId, staffTypeId])
  @@index([staffTypeId])
  @@map("staff_staff_type")
}

// On Staff: replace `staffTypeId` + `staffType` relation with:
//   staffTypes StaffStaffType[]
// Drop the `staff_type_id` column and the `@@index([staffTypeId])`.
//
// On StaffType: replace `staff Staff[]` with:
//   staff StaffStaffType[]
```

`onDelete: Restrict` on the `StaffType` side mirrors today's `onDelete: SetNull` semantics softened to "you can't hard-delete a StaffType while anyone holds it." If the backend dev prefers Cascade (matching the current "if the type goes, the link goes silently") that is also acceptable — `StaffType.archive()` is the production-realistic path either way.

### Wire shape — request

```ts
// Create
interface CreateStaffRequest {
  // ...all existing fields except staffTypeId
  staffTypeIds: string[];   // required, min 1, max N (see Decision 3), all UUIDs
}

// Update
interface UpdateStaffRequest {
  // ...all existing fields except staffTypeId
  staffTypeIds?: string[];  // when present, full replacement of the set
}
```

FE prefers **full-set replacement** semantics on update (PUT-like) rather than `{ add: [...], remove: [...] }` delta semantics. Reason: the dialog already loads the current list, lets the user edit it, and submits the final list. Diffing happens server-side, which is already where the diff matters (for tracked-grant set-diff and audit).

### Wire shape — response

```ts
interface StaffResponse {
  // ...all existing fields except staffTypeId AND staffType
  staffTypes: StaffTypeSummaryDto[];   // denormalized, ordered by StaffType.order ASC
}
```

FE strongly prefers `staffTypes` (nested summaries with `{id, name}`) over `staffTypeIds: string[]` (IDs only). Reason: every list/table/chip in the UI needs `name` — shipping only IDs forces an N+1 lookup against `staff-types` list, which is what the current code already does (`useStaffTypeList` hook) but which we'd love to drop where possible.

Sort by `StaffType.order ASC` so chip color (keyed off `order` modulo palette in `staff-table.tsx:87-93`) is stable across renders.

### Filter on `/staff`

Replace the current allow-list entry `staffTypeId` with `staffTypeIds`, semantics "staff holds **any** of these types." Wire format options (backend dev's call):

- `?filter[staffTypeIds]=A,B` — comma-separated, mapped to `staffTypes: { some: { staffTypeId: { in: [A,B] } } }`.
- `?filter[staffTypeIds]=A&filter[staffTypeIds]=B` — repeated param, same backend handling.

The current FE filter UI is already `isMulti: true` (`staff-table.tsx:57`) and it already serializes as one of the above (whichever the `PrismaQueryService` is wired to). If the `StandardRequest` shape can absorb relation-`some` filters via the allow-list without core changes, great; if it can't, that's a small backend extension to call out in the spec.

### Eligible-staff / "find by type"

- `findByStaffTypeId(staffTypeId)` semantics flip from "staff whose single type is X" to "staff who holds X among their types" — `where: { staffTypes: { some: { staffTypeId } } }`. Same method signature, new meaning.
- `findEligibleForClass` doesn't filter on type today (`prisma-staff.repository.ts:162-200`); unaffected by this refactor.

### Audit

- `EDIT_STAFF_PROFILE.context.rolesGranted` and `.rolesRevoked` already array-shaped — no shape change.
- `before_value.staffTypeIds` / `after_value.staffTypeIds` become **sorted arrays** (sort by UUID lexicographic, or by `StaffType.order`, backend dev's call). FE timeline renderer already handles array diffs via JSON-fallback; pick whichever sort gives stable diffs across renders.

## Pre-Flagged Wrinkles to Resolve (from tracked-grant-revocation)

The tracked-grant spec already named these — re-stating with concrete recommendations:

### Wrinkle 1 — Provenance + the `(userId, roleId, campusId)` unique constraint

A staff with `[Teacher, Vice President]` where both types' `defaultRoleId` happens to be the same role triggers the existing unique constraint on the **second** insert. The tracked-grant spec lists two paths; FE has no strong preference but the implications differ for the FE registry update.

**Option A — Drop the unique constraint, key provenance into the row.**

```prisma
model UserRole {
  // ...
  @@unique([userId, roleId, campusId, grantedViaStaffTypeId])
  //                                ^^^^^^^^^^^^^^^^^^^^^^^
  // was: @@unique([userId, roleId, campusId])
}
```

- Two `user_roles` rows can coexist for the same `(userId, roleId, campusId)` if they have different provenance.
- Manual grants (`grantedViaStaffTypeId IS NULL`) can now coexist with tracked grants for the same `(user, role, campus)`. **This subtly changes the meaning of D5 from `@doc/specs/tracked-grant-revocation`** — manual no longer "wins" via conflict suppression; manual and tracked simply both exist. Permission resolution code is already set-union'd by role ID (`rbac-system.md:191`), so observable permissions don't change. But the audit semantics need to be re-thought: a `GRANT_ROLE`/`EDIT_STAFF_PROFILE.rolesGranted` row would now emit when previously D5 suppressed it.
- Revoke by provenance still works as-is: `DELETE WHERE userId = ? AND granted_via_staff_type_id = ?`. For multi-type set-diff, loop over revoked typeIds or accept an array in `revokeRolesByProvenance`.

**Option B — Keep the unique constraint, externalize provenance.**

Introduce a `user_role_provenance` ledger keyed `(userRoleId, staffTypeId)`. The `user_roles` row stays canonical; provenance is many-to-many.

- One `user_roles` row per `(user, role, campus)` regardless of how many types contributed.
- Revoke: delete provenance row(s); if `user_roles.id` has zero provenance entries left **and** no manual row signal, delete the `user_roles` row. (Manual = a row that never had any provenance entry — a `manuallyGranted boolean` column would disambiguate.)
- More code, but D5's "manual wins" semantic survives literally.

**FE recommendation: Option A.** Cleaner data model, smaller migration, plays naturally with set-diff. The D5 semantic shift is acceptable because the user-observable behavior (which roles does this user effectively hold?) does not change — only the audit log granularity does, and the FE timeline registry already renders array entries one-per-line.

### Wrinkle 2 — Set-vs-scalar revoke semantics

Today's `UpdateStaffUseCase` revoke path (lines 488-508 of `update-staff.use-case.ts`) is keyed on a single `oldStaffTypeId`. Under multi-type, the revoke set is `oldTypeIds \ newTypeIds`, and the grant set is `newTypeIds \ oldTypeIds`.

The `revokeRolesByProvenance(userId, staffTypeId)` port is single-ID. Two options:

- **Loop** in the use case: `for (const typeId of removed) await tx.revokeRolesByProvenance(userId, typeId);`
- **Extend the port** to accept `string[]`: `revokeRolesByProvenance(userId, staffTypeIds: string[])`, single `DELETE … WHERE … AND granted_via_staff_type_id IN (...)`.

FE doesn't see the difference. Backend dev's call — array form is one round-trip per swap which matters at scale, but multi-type swaps are admin-driven and low-frequency.

## Decisions the Backend Dev Needs to Lock

Listed in priority order. FE is happy to discuss any of these but cannot start work until they're settled.

### D1 — Wire shape: `staffTypes: StaffTypeSummaryDto[]` vs `staffTypeIds: string[]`

FE strongly prefers nested summaries. **If backend ships IDs-only, FE has to keep its `useStaffTypeList` lookup map alive in every component that renders a chip** (staff table, staff profile hero, info tab, class profile staff tab, bulk-staff wizard source pane — six surfaces). Nested summaries cut all six.

### D2 — Unique-constraint strategy (Wrinkle 1)

Option A vs Option B above. FE recommendation: Option A.

### D3 — Per-staff type cap

Today's effective cap is 1. What should the new cap be? Product call. Reasonable defaults:

- **Cap 5** — easy to validate, easy to render as chips, avoids abuse.
- **Cap unlimited** — backend allows any non-empty set; FE truncates display with "+N more" pill if it gets long.

FE preference: cap 5. If unlimited, FE adds "+N more" overflow to chip rows but it adds complexity to layouts that were sized for one chip.

### D4 — Minimum type count

Today the FE form requires `staffTypeId.min(1)` even though the DB column is nullable. Is the new shape:

- `staffTypeIds.min(1)` (preserves current "every staff must have a type" UX), **or**
- `staffTypeIds.min(0)` (matches the nullable DB column, allows typeless staff)?

FE preference: **min 1**. Typeless staff are a UX hole today even though the schema allows them — we'd rather not widen that.

### D5 — Migration of existing data

```sql
-- Forward
INSERT INTO staff_staff_type (staff_id, staff_type_id, created_at)
SELECT id, staff_type_id, created_at FROM staff WHERE staff_type_id IS NOT NULL;

ALTER TABLE staff DROP COLUMN staff_type_id;
```

Question for backend dev: rows where `staff.staff_type_id IS NULL` today (typeless staff) become rows with **zero** entries in the join table. If D4 = "min 1," this leaves the system in a state where existing data violates the new invariant on read. Two options:

- Accept the data-only inconsistency (the constraint is enforced at the write path, not the schema).
- Add a data-cleanup step to the migration that picks a sentinel "Unassigned" type or refuses to migrate until ops resolves the orphans.

FE doesn't have a strong preference but flags it because the dialog's "edit existing staff" flow will need to handle "this staff has 0 types — pick one before save" gracefully if option 1 is taken.

### D6 — Deployment strategy

FE assumes an **atomic switch**: backend and frontend deploy together; the wire shape changes from `staffTypeId` (single) to `staffTypes[]` in one PR pair. Single-cut is simpler than a compat window.

If the backend dev wants a compat window (server emits both `staffTypeId` = "primary type, first by order" AND `staffTypes[]` for a release or two), FE can absorb it but it doubles the FE migration cost. Mobile apps are not a consumer of `/staff` today (per FE knowledge), so the only reason to do compat is if the backend dev wants more confidence in the rollout.

### D7 — Bulk operations

`/staff` does not have a bulk-create or bulk-update endpoint today. Single-row write endpoints carry the multi-type change. FE assumes no scope creep here — confirm.

## FE Surfaces That Will Change Once Backend Ships

Listed for the backend dev's situational awareness. FE owns this column.

| Surface | File | Change |
|---|---|---|
| Type wire shape | `src/features/staff/types.ts` | `staffTypeId: string` → `staffTypes: StaffTypeSummaryDTO[]` |
| Create/edit dialog | `src/features/staff/components/staff-dialog.tsx` | `SelectField` → multi-select; Zod `z.array(z.string().uuid()).min(1)` |
| Staff list table | `src/features/staff/components/staff-table.tsx` | Role column renders chip list, sorted by `StaffType.order`; filter wire field renames to `staffTypeIds` |
| Profile info tab | `src/features/staff/components/profile/info-tab.tsx` | Single "Role" `InfoPair` → chip list |
| Profile hero | `src/features/staff/components/profile/staff-profile-hero.tsx` | Single chip → chip list |
| Class profile staff tab | `src/features/classes/components/profile/class-profile-staff-tab.tsx` | Staff row chip → chip list |
| Bulk-staff wizard picker | `src/features/classes/components/bulk-staff-assignment-wizard/source-pane.tsx` | Eligible-staff row chip → chip list (or "primary type" — UX call to be made when implementing) |
| Audit timeline registry | (FE i18n / display registry) | No shape change — `rolesGranted`/`rolesRevoked` already arrays; multi-entry just becomes the norm |

## What's NOT in scope

To keep the backend dev's spec tight, the FE is explicitly **not** asking for any of these:

- `StaffType.defaultRoleId` propagation on edit. Still deferred per D1 of tracked-grant-revocation.
- Archive/restore mutating user_roles. Still deferred per D4 of tracked-grant-revocation.
- Bulk create/update endpoints on `/staff`.
- A "primary type" semantic — chips just render the array sorted by `order`. If the product later wants a primary type for ribbon/avatar purposes, that's a separate field (`primaryStaffTypeId`) and a separate spec.
- Per-type permission overrides ("Teacher's role at Campus A is X but at Campus B is Y"). Out of scope — campus-scoping already handles the multi-campus side.
- Search/filter by combinations ("staff who hold BOTH Teacher AND Vice President") — `some` semantics ("any of") is enough for v1.

## Open Questions for the Backend Dev

These don't need answers before the spec starts — they're things the spec should resolve:

1. **Audit `before_value`/`after_value` sort key for `staffTypeIds`** — by UUID lex, or by `StaffType.order`? Either is fine for FE; the spec just needs to pick one and be consistent.
2. **`StaffTypeSummaryDto` array field name in the response** — `staffTypes` (FE preference) vs anything else? FE has no strong opinion on the name itself.
3. **Snapshot freshness** — today `StaffTypeSnapshot` warning ("may be stale between a mutation and the next read") still applies per-element under multi-type. Worth re-stating in the new entity comment.
4. **Eager-load shape for `findEligibleForClass`** — currently includes `staffType: true`; under the new shape, do we include `staffTypes: { include: { staffType: true } }`? FE consumes `staff.staffType?.name` in `source-pane.tsx` today and will need to switch to `staff.staffTypes.map(t => t.name)` — confirm the include is provided.

## Related Docs

- `@doc/specs/tracked-grant-revocation` — the prerequisite. Already shipped. Already names this refactor in its "Follow-up Tasks" section and pre-flagged the two wrinkles above in "Forward compatibility with `staff-multi-type-refactor`."
- `@doc/architecture/rbac-system` — Roles, UserRoles, the unique constraint `(userId, roleId, campusId)` that drives Wrinkle 1.
- `@doc/references/audit-event-context-shapes` — `EDIT_STAFF_PROFILE` shape; already array-shaped on the role provenance side.
- `@doc/specs/bulk-class-staff-assignment` + `@doc/references/bulk-class-staff-assignment-frontend-handoff` — sibling doc style; this brief mirrors that handoff's structure deliberately.
