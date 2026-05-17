---
title: School Year Enrollment Frontend Handoff
description: 'Backend-authored handoff for the frontend team covering the SchoolYearEnrollment parent-row model shipped in @doc/specs/school-year-enrollment-model. Documents new endpoints, behavioral changes to existing endpoints, error codes, and UX flow implications. Reserved section at the bottom for the upcoming student-status-simplification append.'
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

The "Student Status Simplification" section at the bottom is intentionally a placeholder; it will be filled in once @doc/specs/student-status-simplification ships.

## TL;DR

1. **New parent row**: `SchoolYearEnrollment` (SYE) anchors a student to a `(schoolYear, gradeLevel)` pair. Class enrollments (`Enrollment`) are now its children.
2. **Two-step registration**: students must have an open SYE row in the target school year **before** any class enrollment for that year can be created. There is no auto-create — the frontend must drive the SYE-create step explicitly.
3. **Three new endpoints**: register for school year, withdraw from school (atomic cascade), get student's SY history.
4. **Existing enroll / transfer endpoints now reject** when the SYE parent is missing or its `gradeLevelId` doesn't match the target class.
5. **New error codes** (see table below) — frontend must translate them in form errors and toasts.

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

## Student Status Simplification (Pending)

> **Reserved for append.** Once @doc/specs/student-status-simplification ships, this section will document:
> - Removal of `Student.status` field from request/response shapes
> - New `phase` derived field on `StudentResponse`
> - `isArchived` orthogonal overlay
> - `includeStatuses` query param dropped from eligible-students endpoint
> - Phase taxonomy (ACTIVE / WAITING / DEFERRED / GRADUATED / WITHDRAWN) and how to render each
> - Migration timing for the frontend cutover

Section placeholder — do not delete; it gets filled in as part of the student-status-simplification work.
