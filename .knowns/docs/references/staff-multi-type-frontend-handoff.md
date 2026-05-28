---
title: Staff Multi-Type Frontend Handoff
description: 'Backend-authored handoff for the frontend team covering the v1 staff multi-type refactor shipped in @doc/specs/staff-multi-type-refactor. Documents the new wire shapes (request `staffTypeIds: string[]`, response `staffTypes: StaffTypeSummaryDto[]`), the filter contract (`filter[staffTypeIds]: { in: [...] }` with relation-`some` semantics), the audit `EDIT_STAFF_PROFILE` shape change, the cutover model (atomic switch, no compat shim), the seven decisions the backend locked from the FE brief (D1–D7), error codes, UX implications, and what''s not in this release.'
createdAt: '2026-05-27T23:44:08.501Z'
updatedAt: '2026-05-27T23:44:08.501Z'
tags:
  - reference
  - handoff
  - frontend
  - user-management
  - rbac
  - staff
  - schema-change
---

# Staff Multi-Type Frontend Handoff

## Purpose

Backend-authored handoff for the FE team covering the v1 multi-type staff refactor shipped in @doc/specs/staff-multi-type-refactor. The backend is **complete and merged** — this doc is the contract you build against and the explicit answers to the seven decisions you flagged in @doc/references/staff-multi-type-backend-handoff (D1–D7).

This is the BE → FE counterpart to your earlier FE → BE brief; together they bracket the spec. Where this doc disagrees with the FE brief, the BE shipped what's in this doc.

## TL;DR

- A staff member now holds **1..N concurrent staff types** instead of one. The schema change is a `staff_staff_type` junction table; the legacy `Staff.staff_type_id` scalar is gone.
- Wire shape: requests carry `staffTypeIds: string[]` (full-set replacement on PATCH), responses carry `staffTypes: StaffTypeSummaryDto[]` (`{ id, name }[]` sorted by `StaffType.order ASC`).
- **Atomic cutover** — no compat shim. The old `staffTypeId` / `staffType` fields are removed from every response on day-1 of the FE deploy. Schedule the FE rollout against the BE migration.
- Filter contract: `GET /staff?filter[staffTypeIds]={"in":["...","..."]}` returns staff who hold **any** of the provided types (relation `some`, not `all`).
- Audit `EDIT_STAFF_PROFILE` swaps the `staffTypeId` (string) diff field for `staffTypeIds` (UUID-lex-sorted string array). `rolesGranted` is now always populated on insert success (D5 of @doc/specs/tracked-grant-revocation is retired).
- Min 1 type per staff is enforced on writes; **no max**. Two types sharing the same `defaultRoleId` produce two `user_roles` rows with distinct provenance (revoking one type does not strip the role if another retained type still grants it).

## Mental model

Read-side projection (responses) and write-side payload (requests) intentionally differ:

```
                ┌──────────────────────────────────────┐
                │  GET / list responses                │
                │   staffTypes: [{id,name}, ...]       │  ← projected, ordered, snapshot-shaped
                └──────────────────────────────────────┘
                         ▲ mapper hydrates ▲
                         │                  │
                ┌──────────────────────────────────────┐
                │  POST / PATCH requests               │
                │   staffTypeIds: ["uuid", "uuid"]     │  ← thin, ID-only, full-set replacement
                └──────────────────────────────────────┘
                         │ use case validates + writes │
                         ▼                  ▼
                ┌──────────────────────────────────────┐
                │  staff_staff_type junction table     │  ← per-row provenance enforced at FK level
                └──────────────────────────────────────┘
```

Why two shapes: FE forms / mutation hooks deal in IDs (cheaper to validate, no stale snapshot risk); FE list / detail views need the display name without a second round-trip — so the response carries the snapshot.

The response array is **sorted by `StaffType.order` ASC** (admin-controlled display order). Do not re-sort client-side unless you want a different presentation; the BE has already done it.

## Wire shapes (TypeScript)

### `StaffTypeSummaryDto`

The shared `{ id, name }` snapshot used wherever a response embeds staff types.

```ts
type StaffTypeSummaryDto = {
  id: string;       // UUID
  name: string;     // display name at write-time of the read
};
```

### `StaffResponse` — full staff record

```ts
type StaffResponse = {
  id: string;
  campusId: string;
  staffCode: string;             // immutable, ST-YYYY-XXXXXX
  fullName: string;
  email: string;
  phoneNumber: string;           // E.164
  staffTypes: StaffTypeSummaryDto[];   // ← NEW, sorted by StaffType.order ASC
  // staffTypeId, staffType — REMOVED in v2
  address: string | null;
  dateOfBirth: string | null;    // ISO-8601
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  startDate: string | null;      // ISO-8601
  userId: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};
```

`staffTypes` may be `[]` for **legacy NULL-orphan rows** — staff that pre-existed with `staff_type_id IS NULL` before the migration. They migrate to zero join rows and a PATCH with `staffTypeIds: []` is rejected (400), but a PATCH with `staffTypeIds: [id]` re-establishes the new min-1 invariant. The FE list-row should render "—" or "No types" for those.

### `CreateStaffRequest`

```ts
type CreateStaffRequest = {
  fullName: string;              // 2..100 chars
  email: string;                 // unique within campus
  phoneNumber: string;           // E.164, unique within campus
  gender: "MALE" | "FEMALE" | "OTHER";
  staffTypeIds: string[];        // ← NEW, min 1, no max, all UUIDs
  address?: string;
  dateOfBirth?: string;          // ISO-8601, 18+
  startDate?: string;            // ISO-8601
};
```

### `UpdateStaffRequest`

```ts
type UpdateStaffRequest = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  staffTypeIds?: string[];       // ← NEW, full-set replacement (see semantics below)
  address?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  startDate?: string;
};
```

**PATCH semantic — `staffTypeIds`**:

| Payload                          | Behavior                                                                                    |
|----------------------------------|---------------------------------------------------------------------------------------------|
| `staffTypeIds` **omitted**       | Types left unchanged. Other fields update normally. No role mutation. No audit on this key. |
| `staffTypeIds: []`               | 400 `ARRAY_TOO_SHORT` (`"Staff must have at least one staff type"`). No DB write.            |
| `staffTypeIds: [same set, different order]` | Set-diff is empty. Join table refreshed in-place (delete+recreate); no role mutation; no audit (zero-diff suppression). |
| `staffTypeIds: [...different]`   | Full-set replacement. Diff is `added = newSet \ oldSet`, `removed = oldSet \ newSet`. Tracked role grants follow the diff per @doc/specs/tracked-grant-revocation. Audit emitted with sorted UUID arrays. |

**The PATCH never accepts a "patch" of types** (add this one, remove that one). It's always a full-set replacement. FE forms should hydrate the current set on edit-mode open, then submit the resulting set on save.

### `ClassStaffStaffInfo` — embedded staff snapshot on class-staff endpoints

The class-staff response embeds a slim staff projection for list rendering. The `staffType` (singular) field is **gone**; `staffTypes: StaffTypeSummaryDto[]` replaces it.

```ts
type ClassStaffStaffInfo = {
  id: string;
  fullName: string;
  staffCode: string;
  email: string;
  staffTypes: StaffTypeSummaryDto[];   // ← NEW
};
```

The list-row variant (`ClassStaffStaffInfoLite`) intentionally drops `email` AND `staffTypes` — list rows render only ID + name + code. The detail view fetches the full embed.

## Endpoint behavior summary

### Endpoints whose request/response shape changed (no path change)

| Endpoint                                  | Request change                          | Response change                              |
|-------------------------------------------|-----------------------------------------|----------------------------------------------|
| `POST /staff`                             | `staffTypeId?` → `staffTypeIds: string[]` (min 1) | `staffType?` removed; `staffTypes[]` added   |
| `PATCH /staff/:id`                        | `staffTypeId?` → `staffTypeIds?: string[]` (min 1 when present) | same as above                                |
| `GET /staff/:id`                          | n/a                                     | `staffType?` removed; `staffTypes[]` added   |
| `GET /staff`                              | filter shape change (see below)         | each item: `staffType?` removed; `staffTypes[]` added |
| `GET /classes/:id/staff`                  | n/a                                     | nested `staff.staffType?` removed; `staff.staffTypes[]` added |
| `GET /classes/:id/eligible-staff`         | n/a                                     | same as above                                |

### Endpoints whose behavior changed but shape didn't

- `POST /staff` Clerk-saga compensation still does ONE Clerk user delete per staff; multi-type cardinality doesn't fan it out.
- `PATCH /staff/:id` audit emission rules unchanged: zero-diff suppressed, role-affecting diffs surface in `rolesGranted` / `rolesRevoked`.
- `DELETE /staff/:id` unchanged (still soft-delete via `isArchived`; the join rows survive and re-populate `staffTypes[]` after restore).

### Endpoints with no behavioral or shape change

`POST /staff-types`, `PATCH /staff-types/:id`, archive/restore, every other use case in the user-management surface area. The refactor was scoped to the staff entity's relationship to staff-types, not to staff-types themselves.

## Filter contract — `GET /staff?filter[staffTypeIds]=...`

The filter has migrated from a scalar match to a relation `some` predicate.

### Accepted shapes

```http
GET /staff?filter={"staffTypeIds":{"in":["uuid-1","uuid-2"]}}
GET /staff?filter[staffTypeIds][in]=uuid-1&filter[staffTypeIds][in]=uuid-2
GET /staff?filter[staffTypeIds]=uuid-1   # also accepted (raw single, defensive fallback)
```

### Semantic

Returns staff who hold **any** of the listed types (SQL `EXISTS … WHERE staffTypeId IN (...)`). Not `all` — there is no "AND" semantic for multi-type filter at v1. Empty types `[]` is excluded (legacy NULL-orphan rows do not appear in any `in`-list match).

### Why this matters for the URL builder

`staffTypeIds` is NOT in the public `allowedFilterFields` list — the repository pre-extracts it from the filter envelope before the field-allow-list validator runs, then injects a relation clause into the query's `where`. The filter still works; it just doesn't appear in `/staff`'s self-describing field list if you have any introspection UI.

`sort[staffTypeIds]` is NOT supported. Sort by `fullName`, `staffCode`, `createdAt`, etc.; the array-shape doesn't have a stable scalar sort key.

## Audit shape — `EDIT_STAFF_PROFILE`

The audit `before_value`/`after_value` diff now carries `staffTypeIds: string[]` instead of `staffTypeId: string`.

```ts
// before_value / after_value, when types changed
{
  "staffTypeIds": ["uuid-a", "uuid-b"]   // sorted UUID-lex ASC
}
```

**Sort key is UUID-lex ASC, not `StaffType.order`.** Reason: `StaffType.order` is admin-mutable, so sorting by it would let an unrelated order edit surface as a false diff inside `computeDiff`'s JSON-fallback path. UUIDs are immutable → an identical set under a different insertion order serializes to the same string and produces no diff entry (zero-diff suppression, Scenario 3).

The context arrays — `rolesGranted` and `rolesRevoked` — are also updated:

- `rolesGranted` is **always populated on insert success** under the new 4-col `user_roles` unique with `NULLS NOT DISTINCT`. The prior "count = 0 keeps it `[]`" caveat from D5 of @doc/specs/tracked-grant-revocation is retired. Two added types sharing the same `defaultRoleId` produce two entries with distinct `viaStaffTypeId`.
- `rolesRevoked` is one entry per removed staff-type whose pre-resolved `defaultRoleId` is non-null.

Display-template wording in `@doc/references/audit-event-context-shapes` is unchanged — the timeline renderer already handles arrays.

## Decisions locked (answering the FE brief D1–D7)

| FE-brief decision | What BE shipped | Notes |
|---|---|---|
| **D1** Wire shape | `staffTypes: StaffTypeSummaryDto[]` on responses, `staffTypeIds: string[]` on requests | Snapshot-on-read, ID-only-on-write. Mirrors `Class.gradeLevel` / student class snapshots. |
| **D2** Unique constraint | **4-col unique** `(userId, roleId, campusId, grantedViaStaffTypeId)` with `NULLS NOT DISTINCT` (raw SQL, Prisma can't model it yet) | Per-provenance materialization. Two types sharing a `defaultRoleId` → two rows; revoking one type strips one row; the other survives. D5 manual-wins from @doc/specs/tracked-grant-revocation retired. |
| **D3** Per-staff type cap | **No max** — only `@ArrayMinSize(1)` enforced | FE may apply a soft warning ("Are you sure?") above N for UX, but BE accepts unbounded arrays. |
| **D4** Minimum type count | **Min 1** on writes; legacy rows with 0 types are read-only-tolerated (PATCH with `[]` rejected 400) | Enforced at DTO (`@ArrayMinSize(1)`), domain entity (`setStaffTypes`), and surfaces in the FE form's validator. |
| **D5** Migration of existing data | Single migration: backfill one `staff_staff_type` row per `staff WHERE staff_type_id IS NOT NULL`, copying `created_at` from `staff`. Legacy NULL rows → zero join rows. Drops the legacy column + FK + auto-index in the same migration. | Already merged. FE doesn't need to do anything except handle the "empty `staffTypes`" case in legacy-row rendering. |
| **D6** Deployment strategy | **Atomic cutover** — no compat shim, no dual writes, no `staffType?` carrying forward | The BE and FE deploys must be coordinated as a single coupled release. There is no window where the old single-type FE talks to the new multi-type BE successfully. Plan accordingly. |
| **D7** Bulk operations | **No bulk-multi-type endpoint at v1** | Existing per-staff PATCH covers the single-edit path; bulk is deferred to a follow-up spec. |

## UX implications to plan for

These are observations from the BE side, not requirements — but planning around them now saves churn later.

- **Edit form needs a multi-select** for staff types. The current single-select with a search picker would be replaced by a chip-style or checkbox-list selector. The current value to hydrate it: `staffTypes.map(t => t.id)`.
- **Detail page chips** — `staffTypes` is naturally chip-friendly. Sort order is BE-determined (StaffType.order), don't re-sort client-side.
- **List filters** — the existing single-type dropdown filter should become a multi-select. The wire shape is `filter[staffTypeIds]={"in":[...]}` (see above); `some` semantic means "show staff who hold any of these types".
- **Form validation** — surface `400 ARRAY_TOO_SHORT` ("Staff must have at least one staff type") when the user removes the last chip. Client-side guard (don't allow zero-chip submit) is the cleaner UX.
- **Audit timeline** — the `staffTypeIds` array diff is harder to render than the scalar change. A simple "Added: Teacher, VicePresident · Removed: Nurse" computed client-side from `before_value.staffTypeIds` vs `after_value.staffTypeIds` is the recommended representation. The role-impact arrays (`rolesGranted`, `rolesRevoked`) carry their own secondary timeline line per existing convention.
- **Eligible-staff** — the GET endpoint for "eligible staff to assign to class X" still works; its filter envelope inherits the new `staffTypeIds` semantic if you want to narrow eligibility by type (e.g. "only Homeroom-capable teachers").

## Error codes

No new error codes — multi-type errors reuse the existing validation/auth surface.

| HTTP | Code                       | When                                                              |
|------|----------------------------|-------------------------------------------------------------------|
| 400  | `ARRAY_TOO_SHORT`          | `staffTypeIds: []` on POST or PATCH (when the field is present).  |
| 400  | `INVALID_UUID`             | Any element of `staffTypeIds` not a valid UUID v4.                |
| 400  | `STAFF_TYPE_ARCHIVED`      | Any element references an archived `StaffType`.                   |
| 400  | `STAFF_TYPE_WRONG_CAMPUS`  | Any element belongs to a different campus than the staff.         |
| 404  | `STAFF_TYPE_NOT_FOUND`     | Any element doesn't exist.                                        |
| 409  | `EMAIL_TAKEN` / `PHONE_TAKEN` | Unchanged from v1 (campus-scoped uniqueness).                 |

The validation runs **before the UoW opens**, so a 4xx on any staff-type element rolls nothing back — no Clerk side effect, no DB write, no audit row. The Clerk-saga compensation only fires if the UoW itself throws after the Clerk user was created.

## What's NOT in this release (deferred)

- Bulk multi-type assignment (D7).
- `POST /staff-types/:id/resync` — admin-triggered re-grant when a StaffType's `defaultRoleId` flips. Still deferred from @doc/specs/tracked-grant-revocation; existing staff keep the prior grant until their next staff-type edit.
- Permission UI changes — `user_roles` rows are now per-provenance, but the permission-resolution path is unchanged (set-union by role, dedupe). FE's permission consumer doesn't need to know about the 4-col unique.
- Audit `before_value` / `after_value` rendering for arrays — display logic stays on the FE side, BE just emits the shape.
- A `staffTypeIds` `all`-semantic filter ("staff who hold ALL of these"). Today is `some` only.

## Related docs

- Source-of-truth spec: @doc/specs/staff-multi-type-refactor
- FE-authored input brief: @doc/references/staff-multi-type-backend-handoff
- Tracked-grant primitives the multi-type spec leans on: @doc/specs/tracked-grant-revocation (see the new `## Superseded sections` for the retired D5 manual-wins path)
- Audit-event field shapes (FE display registry consumer): @doc/references/audit-event-context-shapes (`EDIT_STAFF_PROFILE` section was updated for `staffTypeIds`)
- Class-staff embed: `ClassStaffStaffInfo` is now multi-type; see `src/infra/http/dtos/class-management/class-staff.response.ts` for the on-the-wire shape

If anything in this doc conflicts with what you observe on the wire, treat the wire as authoritative and ping me — BE behavior is locked by the integration suite (`staff-multi-type-invariants.integration.spec.ts`, `update-staff-tracked-grant.integration.spec.ts`, `prisma-staff.repository.spec.ts`) but doc drift is always possible.
