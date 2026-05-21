---
title: School Year Enrollment Frontend Handoff
description: 'Backend-authored handoff for the frontend team covering the SchoolYearEnrollment parent-row model shipped in @doc/specs/school-year-enrollment-model and the Student Status Simplification cutover shipped in @doc/specs/student-status-simplification. Documents new endpoints, behavioral changes to existing endpoints, error codes, UX flow implications, and the phase-derivation contract.'
createdAt: '2026-05-16T01:38:09.440Z'
updatedAt: '2026-05-16T01:38:09.440Z'
tags:
  - reference
  - handoff
  - frontend
  - school-year-enrollment
  - class-management
---

## Purpose

This doc is for the **frontend team**. It summarizes what shipped in the backend with the SchoolYearEnrollment parent-row model and what the frontend needs to consume, change, or build to stay coherent with the new contract.

Source of truth: @doc/specs/school-year-enrollment-model. This doc is a digested, action-oriented view of that spec — when in doubt, follow the spec.

## TL;DR

1. **New parent row**: `SchoolYearEnrollment` (SYE) anchors a student to a `(schoolYear, gradeLevel)` pair. Class enrollments (`Enrollment`) are now its children.
2. **Two-step registration**: students must have an open SYE row in the target school year **before** any class enrollment for that year can be created. There is no auto-create — the frontend must drive the SYE-create step explicitly.
3. **Three new endpoints**: register for school year, withdraw from school (atomic cascade), get student's SY history.
4. **Existing enroll / transfer endpoints now reject** when the SYE parent is missing or its `gradeLevelId` doesn't match the target class.
5. **New error codes** (see table below) — frontend must translate them in form errors and toasts.
6. **`Student.status` is gone** (D8 hard cutover, shipped 2026-05-16). `StudentResponse` now exposes derived `phase` + orthogonal `isArchived`. `includeStatuses` query param dropped from `/eligible-students` (D9). See the **Student Status Simplification** section at the bottom — the frontend must ship in lockstep with the backend deploy.

## Mental Model

```
Student
  └── SchoolYearEnrollment (parent, one per school year)   ← NEW
        ├── enrollmentDate, exitDate, exitReason
        ├── gradeLevelId (FIXED for that year)
        └── Enrollment[]  (class-level children, one open at a time)
              ├── enrollmentDate, endDate
              └── classId
```

- **SYE = "is this student a student of ours this school year, in what grade?"**
- **Enrollment = "which classroom are they sitting in right now?"**
- A student may pre-register and hold two open SYEs in different school years simultaneously (summer-transition support).
- Internal class transfers do **not** close the SYE — only the child Enrollment is closed/reopened.
- Withdraw from school = close SYE (and any open child) atomically; this is distinct from class-level withdraw.

## New Endpoints

All three require auth (`Authorization: Bearer <token>`) and the campus header (`X-Campus-Id: <uuid>`). All cross-campus access surfaces as `404 Not Found` (existence is hidden — consistent with the rest of the API).

### 1. `POST /students/:studentId/school-year-enrollments`

Create the parent SYE row. Required before any class enrollment in that school year.

**Request body** (`RegisterForSchoolYearRequest`):
```json
{
  "schoolYearId": "uuid",
  "gradeLevelId": "uuid",
  "enrollmentDate": "2025-09-01",
  "note": "Late registration approved by principal"
}
```

**Response 201** (`SchoolYearEnrollmentResponse`):
```json
{
  "id": "uuid",
  "studentId": "uuid",
  "campusId": "uuid",
  "schoolYearId": "uuid",
  "gradeLevelId": "uuid",
  "enrollmentDate": "2025-09-01T00:00:00.000Z",
  "exitDate": null,
  "exitReason": null,
  "note": "Late registration approved by principal",
  "schoolYear": { "id": "...", "name": "...", "startDate": "...", "endDate": "..." },
  "gradeLevel": { "id": "...", "name": "...", "order": 1 },
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Errors**: `SCHOOL_YEAR_NOT_FOUND` (404), `GRADE_LEVEL_NOT_FOUND` (404), `REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR` (400), `SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS` (409 — same student + same year already has an open SYE).

### 2. `POST /school-year-enrollments/:id/withdraw`

Atomically close the parent SYE and any open child class enrollment in a single DB transaction.

**Request body** (`WithdrawFromSchoolRequest`):
```json
{
  "reason": "WITHDRAWN",
  "exitDate": "2026-03-12",
  "note": "Family relocated overseas"
}
```

- `reason` is required. Valid values: `WITHDRAWN`, `GRADUATED`, `COMPLETED`. **`TRANSFERRED` is intentionally invalid here** — for internal class moves, use the class-transfer endpoint (which doesn't close the SYE).
- `exitDate` is optional; defaults to today if omitted. Must be `>= parent.enrollmentDate` and `<= today`.
- `note` optional, max 500 chars.

**Response 200** (`WithdrawFromSchoolResponse`):
```json
{
  "closedParent": { /* SchoolYearEnrollmentResponse with exitDate + exitReason set */ },
  "closedChild": { /* EnrollmentResponse with endDate + exitReason set */ } // or null
}
```

`closedChild` is `null` when the student had no open class enrollment at withdraw time.

**Errors**: `PARENT_ALREADY_CLOSED` (409 — calling withdraw on a closed parent), `INVALID_EXIT_DATE` (400).

### 3. `GET /students/:studentId/school-year-enrollments`

Full school-year history for one student, ordered `enrollmentDate DESC`.

**Response 200** (`SchoolYearEnrollmentSummaryResponse[]`):

Each row carries the same shape as `SchoolYearEnrollmentResponse` **plus** a `childEnrollmentCount: number` (total class-level enrollments recorded under that parent — both open and closed).

Useful for student-profile screens showing "academic history" timeline.

## Behavior Changes on Existing Endpoints

All single + bulk enroll / transfer endpoints now run two extra gates per row, **after** the existing checks:

| Gate | Condition | Error code | Status |
|---|---|---|---|
| **Parent must exist** | No open SYE row for `(studentId, class.schoolYearId)` | `NO_SCHOOL_YEAR_ENROLLMENT` | 409 |
| **Grade must match** | Open SYE exists but `parent.gradeLevelId !== class.gradeLevelId` | `GRADE_LEVEL_MISMATCH` | 409 |

Affected endpoints:

- `POST /classes/:classId/enrollments` (single enroll) — whole-call 409 on either gate.
- `POST /classes/:classId/enrollments/bulk` — **per-row skip** with the same code in the `skipped[]` array (consistent with the existing two-stage bulk validation pattern).
- `POST /students/:studentId/transfer` (single transfer) — whole-call 409 on grade mismatch (target class).
- `POST /classes/:classId/transfers/bulk` — per-row skip on grade mismatch against the target class.

**Frontend implication**: when the user tries to add a student to a class and the API returns 409 with `NO_SCHOOL_YEAR_ENROLLMENT`, the natural UX is to deep-link them to the "Register for school year" flow (endpoint #1 above) with the right school year pre-selected, then re-attempt the enroll.

For bulk flows, surface the per-row skipped reasons in the result summary so admins can see which students need an SYE created first.

## Error Code Reference

```ts
SchoolYearEnrollmentErrorCode = {
  SCHOOL_YEAR_NOT_FOUND:                 // 404 - SY missing or cross-campus
  GRADE_LEVEL_NOT_FOUND:                 // 404 - grade missing or cross-campus
  REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR:  // 400 - enrollmentDate outside SY range
  SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS: // 409 - 2nd open SYE for same (student, year)
  NO_SCHOOL_YEAR_ENROLLMENT:             // 409 - class enroll/transfer without open SYE
  GRADE_LEVEL_MISMATCH:                  // 409 - parent.gradeLevelId !== class.gradeLevelId
  PARENT_ALREADY_CLOSED:                 // 409 - withdraw on already-closed SYE
  INVALID_EXIT_DATE:                     // 400 - exitDate < enrollmentDate or > today
}
```

Suggested toast/form copy is up to the frontend, but all 8 codes should have user-facing translations. Status codes are stable; treat the `code` string as the discriminator.

## UX Flows to Build / Update

1. **Register-for-school-year flow** — net new screen or modal. Inputs: school year picker, grade level picker, enrollment date, optional note. Submits to endpoint #1.

2. **Class-enroll error recovery** — when a class-enroll call returns `NO_SCHOOL_YEAR_ENROLLMENT`, route the admin to the register flow (#1) pre-filled with the right school year, then resume the enroll.

3. **Bulk-enroll skipped-row summary** — extend the existing bulk-result table to render `NO_SCHOOL_YEAR_ENROLLMENT` and `GRADE_LEVEL_MISMATCH` reasons with a "Register" action button on each row.

4. **Withdraw-from-school flow** — distinct from class withdraw. Surface this on the student profile (not the class roster). Show the cascade outcome (parent + optional child) in the success state.

5. **Student profile "Academic history" tab** — consume endpoint #3 to render a per-year timeline. Each row shows year name, grade, enrollment/exit dates, exitReason, child enrollment count.

6. **Disable `TRANSFERRED` option** on the withdraw-from-school form's reason picker. It's only valid for class-level transfers (which the API exposes via the existing class transfer endpoint).

## What's NOT in This Release (v2 work)

- **Year-end promotion endpoint** — closing one year's SYE and opening the next year's in one atomic call. Today this requires two API calls in sequence.
- **Bulk promote** — same for many students at once.
- **End-of-school-year auto-close cron** — sysadmin closes manually for now.
- **Cross-year class transfers** — transfer endpoints only resolve the parent against the *target* class's school year, but in practice cross-year transfers are blocked by the grade-mismatch gate. Cross-year is explicitly a v2 concern.

Frontend can stub out promotion UI behind a feature flag and ship the rest of the wiring now.

## Auth + Campus Context Reminder

Every new and changed endpoint:
- Requires `Authorization: Bearer <Clerk JWT>`
- Requires `X-Campus-Id: <uuid>` header (the backend's `@RequireCampusAccess` guard enforces this)
- Cross-campus reads/writes return `404` (existence hidden — same convention as the rest of the API)

## Open Coordination Questions

- **Q1** — Does the frontend want a single "register + enroll to first class" combined flow on the wizard, or keep them as two distinct steps? Backend supports either (two API calls; second one will succeed iff first did).
- **Q2** — Should the academic-history endpoint include closed *child* enrollments inline (currently only `childEnrollmentCount` is returned)? If yes, file a backend follow-up to expand the response shape.
- **Q3** — Confirm the frontend's existing toast/form-error infrastructure can render arbitrary `code` strings, not just status codes. If not, we can pre-translate at a gateway layer.

## Student Status Simplification

Shipped 2026-05-16 (commit `ef9dd52`, spec @doc/specs/student-status-simplification). **D8 hard cutover** — `Student.status` is gone from the database, the DTO surface, and the codebase entirely. There is no backward-compat shim. The frontend must update before pulling these backend changes, or every student request will fail validation.

### What changed

1. **`Student.status` is removed.** Drop every reference: form fields, filter pickers, badges, role-based visibility checks, mocks, fixtures.
2. **`StudentResponse` exposes two new fields:**
   - `phase: "WAITING" | "ACTIVE" | "DEFERRED" | "GRADUATED" | "WITHDRAWN" | null` — derived server-side from `Enrollment` + `SchoolYearEnrollment` + `isArchived` via the `student_with_phase` Postgres view. Read-only; there is no setter. `null` only appears on write-path read-back (POST/PATCH return raw `student` rows that don't carry phase) — re-fetch via GET to populate.
   - `isArchived: boolean` — orthogonal overlay. An archived student still carries the underlying derived phase; render both, don't replace one with the other.
3. **`CreateStudentRequest` / `UpdateStudentRequest`: `status` field removed.** Sending it now gets a `400` (global `whitelist + forbidNonWhitelisted` validation pipe).
4. **`GET /classes/:classId/eligible-students`: `includeStatuses` query param removed (D9).** Sending it now gets a `400`. Server-side eligibility is `campusId match AND isArchived=false AND no open Enrollment`. Phase narrowing is purely a client concern.

### Wire shape diff

```diff
 {
   "id": "uuid",
   "campusId": "uuid",
   "studentCode": "2025-000001",
   "fullName": "Nguyễn Văn A",
-  "status": "ACTIVE",
+  "phase": "ACTIVE",
   "isArchived": false,
   ...
 }
```

### Phase taxonomy

| Phase | Means | Suggested badge |
|---|---|---|
| `ACTIVE` | Student has an open `Enrollment` (currently in a class) | green |
| `WAITING` | Registered, no open `Enrollment` and no open `SchoolYearEnrollment` | gray |
| `DEFERRED` | Open `SchoolYearEnrollment` in a future school year (pre-registered, school year hasn't started yet) | blue |
| `GRADUATED` | Latest closed `SchoolYearEnrollment.exitReason = GRADUATED`, no current open enrollment | gold |
| `WITHDRAWN` | Latest closed `SchoolYearEnrollment.exitReason = WITHDRAWN`, no current open enrollment | red |
| `null` | Write-path read-back (immediately after POST/PATCH). Fall back to "Pending" or re-fetch via GET to resolve. | neutral |

`isArchived=true` is independent — render it as a separate badge ("Archived") that sits alongside whichever phase the student carries. An archived student with an open Enrollment still carries `phase=ACTIVE`.

### Eligible-students contract (post-D9)

```
GET /classes/:classId/eligible-students
  ?search=<name fragment>
  &page=<n>&limit=<n>
  &sort=<field:dir>
```

Response is still paginated `StudentResponse[]` — now carrying `phase` + `isArchived` per row, so the bulk-enrollment wizard can render lifecycle indicators per row without a second fetch. Every returned row has no open `Enrollment` (by definition of eligibility), so its phase will always be one of `WAITING`, `DEFERRED`, `GRADUATED`, or `WITHDRAWN` (never `ACTIVE`). If a client wants to narrow further (e.g. show only `WAITING` + `DEFERRED`), filter client-side.

### Frontend migration checklist

1. Remove `status` from every `Student`-related TypeScript type, Zod schema, form field, filter picker, and badge.
2. Add `phase` (typed as the literal-string union above) and `isArchived` to the same types.
3. Drop the `includeStatuses` argument from the eligible-students hook / service.
4. Replace any status-derived UI (badges, filters, lifecycle states) with phase-derived UI per the taxonomy table above. The archive overlay is independent.
5. Audit any place the FE was *setting* `status` on a create/update request — those calls now `400`. The new model is read-only; lifecycle changes happen implicitly through enrollment + SYE actions (register, enroll, transfer, withdraw, archive).
6. Once the backend deploy lands, ship the FE in lockstep — there is no compatibility window.

### Migration timing

- **Backend deploy**: per the cutover PR merging into main. No feature flag — migration `20260515130000_drop_student_status_add_phase_view` drops the column and creates the `student_with_phase` view in a single transaction.
- **Frontend deploy**: must land within the same rollout window. Before backend deploy, FE should be code-complete and ready to ship.
- **Fallback**: if the FE cannot ship in lockstep, back out the backend cutover by reverting the merge commit (the down migration restores the column). Do not try to patch the FE on top of a broken `/students` response — every list call will fail.
