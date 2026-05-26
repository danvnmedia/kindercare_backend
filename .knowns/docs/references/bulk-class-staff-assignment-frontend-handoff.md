---
title: Bulk Class-Staff Assignment Frontend Handoff
description: 'Backend-authored handoff for the frontend team covering the v1 bulk class-staff endpoints shipped in @doc/specs/bulk-class-staff-assignment. Documents POST /classes/:id/staff/bulk, GET /classes/:classId/eligible-staff, per-row validation semantics, the two-stage error model (4xx whole-call vs 200 with skipped[]), full error code reference, request/response wire shapes, and UX flow recommendations for the bulk-assign wizard.'
createdAt: '2026-05-23T20:21:14.466Z'
updatedAt: '2026-05-23T20:21:14.466Z'
tags:
  - reference
  - handoff
  - frontend
  - class-staff
  - class-management
  - bulk
---

# Bulk Class-Staff Assignment Frontend Handoff

## Purpose

Backend-authored handoff for the v1 bulk class-staff endpoints shipped in @doc/specs/bulk-class-staff-assignment. Mirrors the staff-side of the bulk-enrollment wizard that already exists for students. Read this before building the bulk-assign wizard UI.

## TL;DR

- **2 new endpoints**, both campus-scoped, both under `/classes`:
  - `POST /classes/:id/staff/bulk` — assign up to 100 staff in one call, with **per-row roles** (no batch-level role).
  - `GET /classes/:classId/eligible-staff` — paginated picker source: staff at the same campus, not archived, not already assigned to this class.
- **Two-stage error model**: payload-shape errors return **4xx with no work done**; per-row failures return **200 with the failing rows in `skipped[]`** and the rest persisted.
- **Per-row role** in the payload: each row is `{ staffId, role }` where `role ∈ { HOMEROOM, ASSISTANT, BOARDING }`. One call may mix all three.
- **One HOMEROOM per class** — enforced both as a payload check (`MULTIPLE_HOMEROOM_IN_BATCH` if you send 2 HOMEROOM rows) and as a per-row check against the DB (`HOMEROOM_ALREADY_ASSIGNED`).
- **All-or-nothing persistence** for the survivors: every row that passes per-row validation is written in a single DB transaction together with an audit event per row.

## Mental Model

Think of a bulk-assign request as two filters happening in sequence:

```
   payload  ──┐
              ▼
   ┌──────────────────────────────────┐
   │ Stage 1: whole-call validation   │  → on failure: 400 / 404, NO DB work
   │  BATCH_EMPTY                     │
   │  BATCH_TOO_LARGE                 │
   │  DUPLICATE_STAFF_IN_BATCH        │
   │  MULTIPLE_HOMEROOM_IN_BATCH      │
   │  class exists & in campus (404)  │
   └──────────────────────────────────┘
              ▼ (whole payload is shape-valid)
   ┌──────────────────────────────────┐
   │ Stage 2: per-row validation      │  → row fails → push to skipped[]
   │  STAFF_NOT_FOUND                 │     row passes → stays in survivors
   │  STAFF_NOT_IN_CAMPUS             │
   │  STAFF_ALREADY_ASSIGNED          │
   │  HOMEROOM_ALREADY_ASSIGNED       │
   └──────────────────────────────────┘
              ▼
   ┌──────────────────────────────────┐
   │ Persist survivors in ONE         │  → 200 { assigned[], skipped[] }
   │ unitOfWork transaction           │
   │ (mid-batch DB error → 5xx        │
   │  rolls back the whole batch)     │
   └──────────────────────────────────┘
```

The implication for UX: a Stage-1 failure is something the FE could have caught client-side (and probably should, to avoid round trips), but the server enforces it as a backstop. A Stage-2 failure is per-row and shows up in `skipped[]` next to the staffId that failed — the user gets a partial-success result envelope and can choose to retry just the skipped rows.

## New Endpoints

### 1. `POST /classes/:id/staff/bulk`

Bulk-assign staff to a class.

**Headers**
- `x-campus-id: <uuid>` *(required)*
- `Authorization: Bearer <clerk-token>`

**URL params**
- `:id` — class UUID

**Request body**
```json
{
  "staff": [
    { "staffId": "11111111-1111-4111-a111-111111111111", "role": "HOMEROOM" },
    { "staffId": "22222222-2222-4222-a222-222222222222", "role": "ASSISTANT" },
    { "staffId": "33333333-3333-4333-a333-333333333333", "role": "ASSISTANT" },
    { "staffId": "44444444-4444-4444-a444-444444444444", "role": "BOARDING" }
  ]
}
```

Rules:
- `staff` is required, non-empty, max 100 rows.
- Every row has its own `role`. There is **no** batch-level `role` field.
- `staffId` must be a valid UUID; `role` must be one of `HOMEROOM | ASSISTANT | BOARDING`.
- At most one row may carry `role: "HOMEROOM"` (per-class invariant).
- The same `staffId` may appear at most once.

**Success (200)** — `data` is a `BulkAssignStaffResponse`:
```json
{
  "success": true,
  "message": "Bulk assign staff completed",
  "data": {
    "assigned": [
      {
        "classId": "...",
        "staffId": "11111111-1111-4111-a111-111111111111",
        "role": "HOMEROOM",
        "createdAt": "2026-05-23T20:00:27.770Z",
        "updatedAt": "2026-05-23T20:00:27.770Z"
      }
    ],
    "skipped": [
      {
        "staffId": "22222222-2222-4222-a222-222222222222",
        "reason": "STAFF_ALREADY_ASSIGNED",
        "message": "Staff is already assigned to this class"
      }
    ]
  }
}
```

A successful 200 may contain `assigned: []` (all rows were skipped) — that is still a 200, not a 4xx.

**Whole-call error responses (4xx, no rows written, no `skipped[]` in body):**

| HTTP | Code from `message` | When |
|------|---------------------|------|
| 400  | `BATCH_EMPTY`                | `staff.length === 0` |
| 400  | `BATCH_TOO_LARGE`            | `staff.length > 100` |
| 400  | `DUPLICATE_STAFF_IN_BATCH`   | The same `staffId` appears more than once in the payload |
| 400  | `MULTIPLE_HOMEROOM_IN_BATCH` | More than one row has `role: "HOMEROOM"` |
| 404  | `Class with ID … not found`  | Class does not exist **OR** class belongs to a different campus (intentionally indistinguishable — see Auth section) |

**Race rollback (5xx, rare):** if a concurrent assign creates a conflicting `classStaff` row between Stage-2 validation and persistence, the whole transaction rolls back and the endpoint returns 5xx. No partial state, no audit rows. The FE should treat 5xx here as "retry the whole call" rather than "retry the skipped rows."

---

### 2. `GET /classes/:classId/eligible-staff`

Paginated list of staff who are eligible to be assigned to this class. Use this to populate the staff picker in the bulk-assign wizard.

**Headers**
- `x-campus-id: <uuid>` *(required)*
- `Authorization: Bearer <clerk-token>`

**URL params**
- `:classId` — class UUID

**Query params**
- `limit?: number` *(default 10, max 50)*
- `offset?: number` *(default 0)*
- `sort?: string` — e.g. `fullName` or `-createdAt`. Allowed fields: `fullName`, `staffCode`, `createdAt`, `startDate`.
- `search?: string` — case-insensitive substring match on `fullName`.

**Eligibility predicate (every returned staff satisfies all of):**
- `staff.campusId === class.campusId`
- `staff.isArchived === false`
- `NOT EXISTS` any `classStaff` row linking this staff to this class — regardless of role on that row. (So a staff who is currently the HOMEROOM is excluded; a staff who is currently an ASSISTANT is also excluded.)

**Success (200)** — `data.data` is a paginated `StaffResponse[]`:
```json
{
  "success": true,
  "message": "Eligible staff retrieved successfully",
  "data": {
    "data": [
      {
        "id": "...",
        "campusId": "...",
        "staffCode": "ST-2026-000017",
        "fullName": "Nguyễn Thị Lan",
        "email": "lan@example.com",
        "phoneNumber": "+84912345678",
        "staffTypeId": "...",
        "address": "…",
        "dateOfBirth": "1992-04-10T00:00:00.000Z",
        "gender": "FEMALE",
        "startDate": "2024-01-01T00:00:00.000Z",
        "userId": "...",
        "isArchived": false,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "count": 42,
      "limit": 10,
      "offset": 0,
      "totalPages": 5,
      "currentPage": 1,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

**Errors:**
- `404` — class does not exist OR class is in a different campus (same body for both).

## Wire Shapes (TypeScript)

Copy these into the FE codebase if you don't already auto-generate from OpenAPI.

```ts
type ClassStaffRole = "HOMEROOM" | "ASSISTANT" | "BOARDING";

// POST request
interface BulkAssignStaffRequest {
  staff: Array<{ staffId: string; role: ClassStaffRole }>;
}

// POST response (inside the StandardResponse envelope)
interface BulkAssignStaffResponse {
  assigned: ClassStaffResponse[];
  skipped: Array<{
    staffId: string;
    reason: ClassStaffErrorCode;   // see Error Code Reference below
    message?: string;
  }>;
}

interface ClassStaffResponse {
  classId: string;
  staffId: string;
  role: ClassStaffRole;
  class?: { id: string; name: string };
  staff?: { id: string; fullName: string; email: string; staffType: string };
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
}

// GET /eligible-staff query
interface EligibleStaffQuery {
  limit?: number;
  offset?: number;
  sort?: string;
  search?: string;
}
```

## Error Code Reference

All bulk-flow error codes are now centralized in the `ClassStaffErrorCode` enum on the backend. Mirror this on the FE:

```ts
type ClassStaffErrorCode =
  // Single-row codes (existing)
  | "HOMEROOM_ALREADY_ASSIGNED"
  | "STAFF_ALREADY_ASSIGNED"
  | "STAFF_NOT_FOUND_IN_CLASS"
  // Bulk-only codes (new, this release)
  | "BATCH_EMPTY"
  | "BATCH_TOO_LARGE"
  | "DUPLICATE_STAFF_IN_BATCH"
  | "MULTIPLE_HOMEROOM_IN_BATCH"
  | "STAFF_NOT_FOUND"
  | "STAFF_NOT_IN_CAMPUS";
```

**Where each code surfaces:**

| Code | Stage | HTTP | Where to read it |
|------|-------|------|------------------|
| `BATCH_EMPTY`                | Whole-call (DTO)  | 400 | Exception body `message` |
| `BATCH_TOO_LARGE`            | Whole-call (DTO)  | 400 | Exception body `message` |
| `DUPLICATE_STAFF_IN_BATCH`   | Whole-call (use-case) | 400 | Exception body `message` |
| `MULTIPLE_HOMEROOM_IN_BATCH` | Whole-call (use-case) | 400 | Exception body `message` |
| `STAFF_NOT_FOUND`            | Per-row | 200 | `skipped[].reason` |
| `STAFF_NOT_IN_CAMPUS`        | Per-row | 200 | `skipped[].reason` |
| `STAFF_ALREADY_ASSIGNED`     | Per-row | 200 | `skipped[].reason` |
| `HOMEROOM_ALREADY_ASSIGNED`  | Per-row | 200 | `skipped[].reason` |

**Suggested user-facing messages (Vietnamese-first, since the product is for VN kindergartens):**

| Code | Suggested copy |
|------|----------------|
| `BATCH_EMPTY` | "Vui lòng chọn ít nhất một nhân viên." |
| `BATCH_TOO_LARGE` | "Mỗi lần phân công tối đa 100 nhân viên." |
| `DUPLICATE_STAFF_IN_BATCH` | "Một nhân viên không thể được phân công nhiều lần trong cùng một lượt." |
| `MULTIPLE_HOMEROOM_IN_BATCH` | "Mỗi lớp chỉ có thể có một giáo viên chủ nhiệm." |
| `STAFF_NOT_FOUND` | "Không tìm thấy nhân viên." |
| `STAFF_NOT_IN_CAMPUS` | "Nhân viên không thuộc cơ sở này." |
| `STAFF_ALREADY_ASSIGNED` | "Nhân viên đã được phân công vào lớp này." |
| `HOMEROOM_ALREADY_ASSIGNED` | "Lớp này đã có giáo viên chủ nhiệm." |

These are suggestions — final copy is the FE/product call.

## UX Flows to Build

### Bulk-assign wizard (suggested 3 steps)

**Step 1: Pick staff**
- Source: `GET /classes/:classId/eligible-staff` with `?search=` wired to the search input.
- Allow multi-select up to 100. Reflect remaining-quota inline.
- The list is already campus-scoped on the server — no need to filter client-side.

**Step 2: Assign roles**
- For each picked staff, render a role select (`HOMEROOM | ASSISTANT | BOARDING`). Default to `ASSISTANT` (the most common case).
- Show a banner / inline warning if the user picks **2** `HOMEROOM`s — that's `MULTIPLE_HOMEROOM_IN_BATCH` and would 400 from the server. Catch it client-side as a hard block before submit.
- If the class already has a HOMEROOM (you can detect this by checking `GET /classes/:id/staff` in advance), surface a hint that any HOMEROOM pick will hit `HOMEROOM_ALREADY_ASSIGNED` and be skipped. Either let the user proceed (and surface the skipped row after submit) or block submit — product call.

**Step 3: Submit & resolve**
- `POST /classes/:id/staff/bulk` with the constructed payload.
- On 200: render a results panel with two sections, "Đã phân công" (`assigned[]`) and "Đã bỏ qua" (`skipped[]`). Each skipped row shows the suggested message keyed on `reason`.
- Offer a "Retry skipped" action that re-opens Step 2 with only the skipped rows pre-loaded — useful for the `STAFF_NOT_IN_CAMPUS` / `STAFF_ALREADY_ASSIGNED` cases where the user may want to remove the staff from the wizard rather than retry.
- On 4xx: render the message tied to the exception body. No `skipped[]` to render in this branch.
- On 5xx (race rollback): "Một thay đổi đồng thời đã xảy ra — vui lòng thử lại." Re-fetch eligible staff before retry, since the conflict state has changed.

### Single-row endpoints still exist

The pre-existing single-row endpoints have not been deprecated and continue to work:
- `POST /classes/:id/staff` — single assign
- `DELETE /classes/:id/staff/:staffId` — remove
- `PATCH /classes/:id/staff/:staffId/role` — change role

Use bulk for the multi-add flow; keep single-row for in-place edits and one-off removes on the class profile page.

## Auth + Campus Context Reminder

- Both endpoints require `x-campus-id` (the campus the user is acting within).
- Cross-campus class lookups return **404 with the same body** as "class not found." That's intentional — clients in campus A cannot probe whether a class exists in campus B. Do not branch UX on these two cases; treat them as one.
- All audit events emitted by the bulk endpoint carry `actorId`, `actorName`, `campusId`, `classId`, and `role` per row — these show up in the admin audit log under the `ASSIGN_STAFF_TO_CLASS` action (same shape as the single-row flow, no FE-side templating changes needed).

## What's NOT in This Release (deferred)

- **No batch-level role field.** Every row carries its own role; if the FE finds itself wanting "assign these 5 as ASSISTANT" as a single switch, it should set `role: "ASSISTANT"` on each row at construction time.
- **No bulk-remove or bulk-change-role.** Only bulk-add is in v1. Removes and role changes remain single-row.
- **No `?include=staff` expansion** on the response — `assigned[].staff` may be `undefined` depending on backend mapper behavior. If you need staff fullName/email in the results panel, hold onto the staff objects from the picker in component state rather than relying on the response to re-deliver them.
- **No retry-with-idempotency-key.** A retry of the same call after partial success will simply skip the now-assigned rows (`STAFF_ALREADY_ASSIGNED`), which is acceptable for this flow but worth knowing.

## Related Docs

- @doc/specs/bulk-class-staff-assignment — the source-of-truth spec, including locked decisions (D1–D10) and full acceptance criteria.
- @doc/specs/subject-removal-classstaff-role-refactor — earlier refactor that introduced the `ClassStaffRole` enum and the single-row endpoints.
- @doc/references/school-year-enrollment-frontend-handoff — sibling FE handoff for the student enrollment flows (same docstyle and conventions).
