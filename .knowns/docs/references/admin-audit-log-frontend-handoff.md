---
title: Admin Audit Log Frontend Handoff
description: 'Backend-authored handoff for the frontend team covering the v1 admin audit log shipped in @doc/specs/admin-audit-log. Documents the read endpoints, response shapes, the action-code import recipe, per-action context shapes, the FE template registry location decision, error codes, AND a greenfield implementation guide (routes, component breakdown, complete 19-action template set, React Query setup, mock fixtures, build order, tech-stack alignment) for a from-zero FE build.'
createdAt: '2026-05-20T16:02:04.910Z'
updatedAt: '2026-05-20T19:45:51.452Z'
tags:
  - reference
  - handoff
  - frontend
  - audit-log
---

## Purpose

This doc is for the **frontend team**. It summarizes what shipped backend-side for the admin audit log (v1) and what the frontend needs to consume to render the entity-history and actor-activity admin pages.

Source of truth: @doc/specs/admin-audit-log. This doc is a digested, action-oriented view of that spec — when in doubt, follow the spec.

## TL;DR

1. **Two new read endpoints**: `GET /audit/by-target` (entity history) and `GET /audit/by-actor` (actor activity). Both are paginated, DESC by `createdAt`.
2. **Auth contract**: `Authorization: Bearer <jwt>` + `X-Campus-Id: <uuid>` + permission `audit.read`. Cross-campus reads return an empty list (NOT 404 — different from the rest of the API, by design — see Open Question resolution at the bottom).
3. **Action vocabulary is exported as JSON**: 19 v1 action codes live in `generated/audit-actions.json` (regenerated from the BE source via `npm run export:audit-actions`). The FE imports this JSON and snapshot-tests its template registry against it — drift is caught at test time.
4. **Per-action context shapes** are documented in @doc/references/audit-event-context-shapes. The FE's display templates substitute snapshot fields from this `context` object (`actorName`, `studentName`, `fromClassName`, etc.).
5. **FE template registry location** (resolves Open Question): recommend `frontend/src/i18n/audit-templates.{locale}.json` keyed by `audit.{ACTION}.display`, one entry per action, snapshot-tested against the BE export.

## Mental Model

```
GET /audit/by-target?targetType=student&targetId=<uuid>
                        │
                        ▼
              Paginated AuditEvent rows
               (DESC by createdAt)
                        │
                        ▼
   For each row, FE looks up audit.{action}.display in its template
   registry and substitutes from row.context + row.beforeValue/afterValue
```

- The BE never renders the human-readable display string. The FE owns localization.
- Snapshot fields in `context` are **frozen at write time** — they survive hard delete of the target (Scenario 4 of the spec). The FE must trust `context.studentName` over a separate lookup.
- The audit log is append-only — there's no edit / delete endpoint, and no FE need for one.

## Endpoints

Both endpoints require:
- `Authorization: Bearer <jwt>` — Clerk-issued JWT
- `X-Campus-Id: <uuid>` — campus context (system-enforced on the row filter; NOT a user-controllable filter)
- Permission `audit.read` on the calling user for the campus

Pagination follows the project convention (see @doc/guides/pagination-and-filtering):
- `?limit=<n>` (default 20, capped at 50)
- `?offset=<n>` (default 0)

### 1. `GET /audit/by-target`

Entity history — every audit event for one student / guardian / staff target.

**Query**:
- `targetType` — one of `student` / `guardian` / `staff` (required)
- `targetId` — UUID (required)
- `limit`, `offset` — pagination

**Response 200** (`PaginatedResult<AuditEventResponse>`):
```json
{
  "data": [
    {
      "id": "uuid",
      "actorId": "uuid",
      "action": "TRANSFER_STUDENT",
      "targetType": "student",
      "targetId": "uuid",
      "campusId": "uuid",
      "beforeValue": null,
      "afterValue": null,
      "context": {
        "actorName": "Alice Nguyen",
        "studentName": "Bob Tran",
        "fromClassId": "uuid",
        "fromClassName": "Sunflowers",
        "toClassId": "uuid",
        "toClassName": "Roses",
        "transferDate": "2026-05-18"
      },
      "visibility": "ADMIN",
      "createdAt": "2026-05-18T08:30:00.000Z"
    }
  ],
  "pagination": {
    "count": 47,
    "limit": 20,
    "offset": 0,
    "totalPages": 3,
    "currentPage": 1,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 2. `GET /audit/by-actor`

Actor activity — every audit event the named user emitted.

**Query**:
- `actorId` — UUID (required)
- `limit`, `offset` — pagination

**Response 200**: same `PaginatedResult<AuditEventResponse>` shape as above.

## Action Vocabulary

The 19 v1 action codes (spec FR-1) are exported to `generated/audit-actions.json` at the repo root. **Regenerate any time `AUDIT_ACTIONS` changes BE-side**:

```bash
npm run export:audit-actions
```

The JSON has this shape:

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-05-20T...",
  "source": "src/domain/audit/audit-action.enum.ts",
  "spec": "@doc/specs/admin-audit-log",
  "actions": [
    "ENROLL_STUDENT_TO_CLASS",
    "TRANSFER_STUDENT",
    "WITHDRAW_FROM_CLASS",
    "REGISTER_FOR_SCHOOL_YEAR",
    "WITHDRAW_FROM_SCHOOL_YEAR",
    "EDIT_STUDENT_PROFILE",
    "EDIT_GUARDIAN_PROFILE",
    "EDIT_STAFF_PROFILE",
    "ARCHIVE_STUDENT",
    "RESTORE_STUDENT",
    "ARCHIVE_GUARDIAN",
    "RESTORE_GUARDIAN",
    "ARCHIVE_STAFF",
    "RESTORE_STAFF",
    "CREATE_STUDENT",
    "CREATE_GUARDIAN",
    "CREATE_STAFF",
    "LINK_GUARDIAN_TO_STUDENT",
    "UNLINK_GUARDIAN_FROM_STUDENT"
  ]
}
```

### FE import recipe

The recommended pattern (resolves the spec Open Question on template-registry location):

1. **Vendor the JSON into the FE repo** — copy `generated/audit-actions.json` into `frontend/src/audit-actions.json` (or wire a CI step that copies it). Treat the file as a build-time contract; do NOT fetch it at runtime.
2. **Type the action union**:
   ```ts
   import auditActions from "./audit-actions.json";
   export type AuditAction = typeof auditActions.actions[number];
   ```
3. **Define the template registry** at `frontend/src/i18n/audit-templates.{locale}.json`, keyed by `audit.{ACTION}.display`. Example for `en`:
   ```json
   {
     "audit.ENROLL_STUDENT_TO_CLASS.display": "{{actorName}} enrolled {{studentName}} into {{className}}",
     "audit.TRANSFER_STUDENT.display": "{{actorName}} transferred {{studentName}} from {{fromClassName}} to {{toClassName}}",
     "audit.WITHDRAW_FROM_CLASS.display": "{{actorName}} withdrew {{studentName}} from {{className}}",
     "...": "...one entry per action"
   }
   ```
4. **Snapshot test** the registry: assert that for every action in `auditActions.actions`, there is an entry `audit.{ACTION}.display` in every locale file. This fails closed whenever the BE adds a new action and the FE hasn't added the matching template.

## Per-Action Context Shapes

The `context` jsonb shape varies by action. Source of truth: @doc/references/audit-event-context-shapes — every action has a documented shape with field names, types, and example values.

High-level invariants across all 19 actions:

- `actorName: string | null` — always present (snapshot of the actor's display name at write time)
- For target-named actions: `studentName` / `guardianName` / `staffName` is present where relevant
- For EDIT_* actions: only the changed fields land in `beforeValue` / `afterValue`; `context` carries only the actor/target snapshot (Scenario 3 of the spec)
- For LINK_GUARDIAN_TO_STUDENT / UNLINK_GUARDIAN_FROM_STUDENT: both `studentName` and `guardianName` are present plus `relationshipType`

When the FE substitutes a template, missing context keys MUST be rendered as a localized placeholder ("(unknown)" / "(không xác định)") rather than breaking the row — old audit rows may predate a context-shape change.

## Error Codes

| HTTP | Trigger | FE handling |
|---|---|---|
| 200 (empty `data: []`) | Cross-campus read (target/actor exists in a campus the caller doesn't have access to) | Render "No audit events for this target / actor" — do NOT show an error toast. |
| 400 | Invalid `targetType` (not `student` / `guardian` / `staff`) | Form validation should prevent this; surface a generic "Invalid request" if it slips through. |
| 400 | Invalid UUID format on `targetId` / `actorId` | Same as above. |
| 401 | Missing / invalid JWT | Redirect to login. |
| 403 | Caller lacks `audit.read` for the current campus | Hide the audit page from navigation rather than relying on this catch. |

## Open Questions resolved by this handoff

- **Permission slug**: `audit.read` (lowercase, dot-separated — matches `module.action` convention used by every other guarded endpoint).
- **Template registry location**: `frontend/src/i18n/audit-templates.{locale}.json`. Snapshot-tested against `generated/audit-actions.json`. FE team owns the final placement; this is the BE-side recommendation.
- **Cross-campus = empty, not 404**: chosen deliberately so the entity-history admin page can render "this user has nothing to show here" rather than the existence-hiding 404 used elsewhere. The campus filter is system-enforced via `scope.campusId` at the repo layer (see @doc/specs/admin-audit-log FR-5).

## Still Open (out of v1 scope)

- Cross-campus reads for super-admins
- Bulk export (CSV / JSON download)
- Time-range filter on reads (`?from=&to=`)
- Action-type filter on reads (`?actions=TRANSFER,WITHDRAW`)
- Guardian-visible reads (flip `visibility` defaults + add guardian-scoped endpoint)
- Cross-entity feed: `GET /audit/recent` for "today at campus X" admin view
- Right-to-be-forgotten redaction path (preserve row shape, blank actor name)

See @doc/specs/admin-audit-log "Deferred to v2" for the full list. When any of these ship, append a new section to this doc rather than spinning up a separate handoff.

## Frontend Implementation Guide (greenfield)

This section helps the FE team build the audit-log UI from zero — no existing components, no existing routes. Walks through suggested page structure, the complete display-template set for all 19 actions, suggested component breakdown, mock fixtures, and a recommended build order.

### Suggested routes

Two admin-only pages, both gated behind `audit.read`:

- `/admin/audit/[targetType]/[targetId]` — entity history (FR-5)
  - Example: `/admin/audit/student/abc-123`
  - Reached from a "View audit history" action on the student / guardian / staff detail page
- `/admin/audit/actor/[actorId]` — actor activity (FR-6)
  - Example: `/admin/audit/actor/staff-456`
  - Reached from a "View this user's actions" action on the staff detail page

Both server-rendered (Next.js per project stack). Permission gating lives in the layout: hide the link entirely if the current user lacks `audit.read` — don't rely on the 403 as a UX gate.

### Component breakdown

```
<AuditTimelinePage>
  <PageHeader title="Audit History" subtitle={targetDisplayName} />
  <AuditEventList>
    {pages.map(page =>
      page.data.map(event => <AuditEventRow event={event} />)
    )}
  </AuditEventList>
  <LoadMoreButton />              ← visible when pagination.hasNext
  <EmptyState />                  ← when data: []
  <LoadingState />                ← skeleton rows during initial fetch
  <ErrorState />                  ← 401 redirect, 403 inline, network toast
</AuditTimelinePage>

<AuditEventRow>
  <Avatar actorName={event.context.actorName} />
  <DisplayString>{templateRegistry[event.action](event.context)}</DisplayString>
  <DiffPanel before={event.beforeValue} after={event.afterValue} />  ← only when both are non-null
  <RelativeTime date={event.createdAt} />
</AuditEventRow>
```

### React Query setup

Suggested query-key shape so cache invalidation is predictable:

```ts
export const auditKeys = {
  all: ["audit"] as const,
  byTarget: (campusId: string, targetType: string, targetId: string) =>
    [...auditKeys.all, "by-target", campusId, targetType, targetId] as const,
  byActor: (campusId: string, actorId: string) =>
    [...auditKeys.all, "by-actor", campusId, actorId] as const,
};
```

Use `useInfiniteQuery` with:
```ts
getNextPageParam: (last) =>
  last.pagination.hasNext
    ? last.pagination.offset + last.pagination.limit
    : undefined
```

Audit reads are append-only — no mutation triggers cache invalidation. The cache can stay warm across the session; a fresh visit refetches naturally.

### Complete display-template set (English)

Drop-in templates for `frontend/src/i18n/audit-templates.en.json`, keyed by `audit.{ACTION}.display`. Substitute from `event.context`. Add the Vietnamese parallel keys when the locale ships.

| Action | Template |
|---|---|
| `ENROLL_STUDENT_TO_CLASS` | `{{actorName}} enrolled {{studentName}} into {{className}}` |
| `TRANSFER_STUDENT` | `{{actorName}} transferred {{studentName}} from {{fromClassName}} to {{toClassName}}` |
| `WITHDRAW_FROM_CLASS` | `{{actorName}} withdrew {{studentName}} from {{className}}` |
| `REGISTER_FOR_SCHOOL_YEAR` | `{{actorName}} registered {{studentName}} for school year {{schoolYearName}} ({{gradeLevelName}})` |
| `WITHDRAW_FROM_SCHOOL_YEAR` | `{{actorName}} withdrew {{studentName}} from school year {{schoolYearName}}` |
| `EDIT_STUDENT_PROFILE` | `{{actorName}} edited {{studentName}}'s profile` |
| `EDIT_GUARDIAN_PROFILE` | `{{actorName}} edited {{guardianName}}'s profile` |
| `EDIT_STAFF_PROFILE` | `{{actorName}} edited {{staffName}}'s profile` |
| `ARCHIVE_STUDENT` | `{{actorName}} archived {{studentName}}` |
| `RESTORE_STUDENT` | `{{actorName}} restored {{studentName}}` |
| `ARCHIVE_GUARDIAN` | `{{actorName}} archived {{guardianName}}` |
| `RESTORE_GUARDIAN` | `{{actorName}} restored {{guardianName}}` |
| `ARCHIVE_STAFF` | `{{actorName}} archived {{staffName}}` |
| `RESTORE_STAFF` | `{{actorName}} restored {{staffName}}` |
| `CREATE_STUDENT` | `{{actorName}} created student {{name}} ({{code}})` |
| `CREATE_GUARDIAN` | `{{actorName}} created guardian {{name}}` |
| `CREATE_STAFF` | `{{actorName}} created staff {{name}} ({{code}})` |
| `LINK_GUARDIAN_TO_STUDENT` | `{{actorName}} linked {{guardianName}} to {{studentName}} as {{relationshipType}}` |
| `UNLINK_GUARDIAN_FROM_STUDENT` | `{{actorName}} unlinked {{guardianName}} from {{studentName}}` |

Field-name keys come straight from @doc/references/audit-event-context-shapes — the exact set per action is documented there with example payloads.

**Diff rendering for EDIT_* actions.** When `event.beforeValue` and `event.afterValue` are both non-null, render the diff inline below the display string:

```
Alice Nguyen edited Bob Tran's profile
  • Phone Number: 555-1111 → 555-2222
  • Email: bob@old.com → bob@new.com
```

Field name humanization (`camelCase` → "Phone Number") is a FE concern — add a small `humanizeFieldName(key)` util.

### Empty / loading / error states

- **Empty** (`200` with `data: []`): render "No audit events to show for this target." Could be cross-campus (caller can't see other-campus rows) OR genuinely no activity. Do NOT distinguish — the BE deliberately returns empty rather than 404 so the page renders cleanly in both cases.
- **Loading**: 3–5 skeleton rows. Don't full-screen spinner — the timeline is the only meaningful content on the page.
- **Auth (401)**: redirect to login via the project's auth context.
- **Permission (403)**: the link/menu entry should already be hidden by gating. If it slips through (e.g. role revocation mid-session), render an inline "You don't have permission to view audit history" panel — don't toast and redirect.
- **Network error**: toast + Retry button on the timeline. Preserve already-loaded pages.

### Permission gating

The link/menu entry MUST be hidden client-side if the current user's permission set doesn't include `audit.read` for the active campus. The 403 from the BE is a backstop, NOT the UX gate.

```tsx
{userHasPermission("audit.read") && (
  <Link href={`/admin/audit/student/${student.id}`}>View audit history</Link>
)}
```

### Mock fixture for development

Drop this into a JSON fixture to develop the timeline UI without a live BE. Covers TRANSFER (no diff) + EDIT (with diff) so both render paths are exercised.

```json
{
  "data": [
    {
      "id": "11111111-1111-4111-a111-111111111111",
      "actorId": "actor-1",
      "action": "TRANSFER_STUDENT",
      "targetType": "student",
      "targetId": "student-1",
      "campusId": "campus-1",
      "beforeValue": null,
      "afterValue": null,
      "context": {
        "actorName": "Alice Nguyen",
        "studentName": "Bob Tran",
        "fromClassId": "class-1",
        "fromClassName": "Sunflowers",
        "toClassId": "class-2",
        "toClassName": "Roses",
        "transferDate": "2026-05-18"
      },
      "visibility": "ADMIN",
      "createdAt": "2026-05-18T08:30:00.000Z"
    },
    {
      "id": "22222222-2222-4222-a222-222222222222",
      "actorId": "actor-1",
      "action": "EDIT_STUDENT_PROFILE",
      "targetType": "student",
      "targetId": "student-1",
      "campusId": "campus-1",
      "beforeValue": { "phoneNumber": "555-1111", "email": "bob@old.com" },
      "afterValue": { "phoneNumber": "555-2222", "email": "bob@new.com" },
      "context": { "actorName": "Alice Nguyen", "studentName": "Bob Tran" },
      "visibility": "ADMIN",
      "createdAt": "2026-02-15T14:30:00.000Z"
    },
    {
      "id": "33333333-3333-4333-a333-333333333333",
      "actorId": "actor-1",
      "action": "CREATE_STUDENT",
      "targetType": "student",
      "targetId": "student-1",
      "campusId": "campus-1",
      "beforeValue": null,
      "afterValue": null,
      "context": {
        "actorName": "Alice Nguyen",
        "name": "Bob Tran",
        "code": "STU-2026-000123"
      },
      "visibility": "ADMIN",
      "createdAt": "2026-01-10T09:00:00.000Z"
    }
  ],
  "pagination": {
    "count": 3,
    "limit": 20,
    "offset": 0,
    "totalPages": 1,
    "currentPage": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### Where to put the "View audit history" link

Add a row to the action menu on each entity detail page:

- Student detail page (`/students/[id]`) → "View audit history" → `/admin/audit/student/[id]`
- Guardian detail page (`/guardians/[id]`) → "View audit history" → `/admin/audit/guardian/[id]`
- Staff detail page (`/staff/[id]`) → "View audit history" → `/admin/audit/staff/[id]`
- Staff detail page also gets "View this user's actions" → `/admin/audit/actor/[user.id]` (note: maps to the User UUID, not the Staff UUID)

### Recommended build order

For a from-zero build, this sequence minimizes rework:

1. **Vendor the action list**: copy `generated/audit-actions.json` from the BE repo into `frontend/src/audit-actions.json`. Wire a build-time check (snapshot test or CI script) that compares the two files — any divergence means the BE shipped a new action and the FE template registry needs an entry. Treat divergence as a deploy blocker.
2. **Define the template registry**: drop the English table above into `frontend/src/i18n/audit-templates.en.json`. Add the Vietnamese parallel file with translated strings.
3. **Build the API client** with Zod schemas matching `AuditEventResponse` + the `PaginatedResult` envelope. Validate at the boundary; don't trust the wire blindly.
4. **Build `<AuditEventRow>` in isolation** against the mock fixture above. Get the template substitution + diff rendering correct before wiring into the timeline.
5. **Wire `<AuditTimelinePage>`** with `useInfiniteQuery`, empty / loading / error states, and the load-more button.
6. **Add routes** for entity-history (`/admin/audit/[targetType]/[targetId]`) and actor-activity (`/admin/audit/actor/[actorId]`). Add the menu links behind the permission gate.
7. **Permission integration**: ensure the current-user's permission resolution honours `audit.read` per active campus.
8. **E2E smoke test**: pull up the audit page for a known student in a dev environment; verify each represented action group renders without missing-context-field placeholders.

### Tech stack alignment notes

- **Zod**: validate `AuditEventResponse` at the API client boundary. The `context` jsonb is open-ended (different fields per action), so use `z.record(z.unknown())` for that one field and rely on the per-action template to project the fields it needs.
- **React Query**: `useInfiniteQuery` per the snippet above. Audit reads are append-only — no mutation triggers cache invalidation.
- **react-hook-form**: not needed for v1 (no filters beyond pagination). If a v2 ships action-type / date-range filters, that's where it would land.
- **Date formatting**: `createdAt` is always UTC ISO. Format to the campus's local time on render using the project's existing date util (don't hand-roll). Show relative time ("3 days ago") for events in the last 7 days, absolute ("Feb 15, 2026") beyond that.
- **Locale fallback**: if a template key is missing for the current locale, fall back to English. NEVER render the raw action code to the user.

### What NOT to build (v2 / out of scope)

These will surface as "missing feature" requests but are deliberately out of v1:

- No bulk export (CSV / JSON download)
- No filters (action type, date range, free-text search) — v1 is paginated DESC by `createdAt` only
- No guardian-facing audit view (`visibility=GUARDIAN_VISIBLE` is reserved for v2)
- No cross-campus super-admin view
- No "today at campus X" feed across all entities
- No edit / delete on audit rows (append-only — there's no API surface)

See @doc/specs/admin-audit-log "Deferred to v2" for the full list. When any of these ship, append a new section to this doc rather than spinning up a separate handoff.
