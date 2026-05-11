---
title: Bulk Enrollment Backend Handoff
description: 'Backend gap analysis + endpoint contracts the backend dev needs to ship before the frontend bulk-enrollment wizard can start. Documents what exists, what''s missing, and the exact shapes/validation rules to add.'
createdAt: '2026-05-08T02:47:54.129Z'
updatedAt: '2026-05-08T02:47:54.129Z'
tags:
  - reference
  - handoff
  - backend
  - bulk-enrollment
  - class-management
---

## Purpose

The frontend wants to build a **bulk-enrollment wizard** for class management. This brief enumerates what the backend already exposes, what's missing, and the exact endpoint contracts the backend should ship before the frontend can start.

Audience: backend dev. Once these pieces land, frontend will spec/plan/implement the wizard UX (multi-step shadcn dialog: pick destination class → pick eligible students → set enrollment date → review → submit → per-row result).

---

## What backend ALREADY ships (no changes needed)

| Capability | Endpoint | Notes |
|---|---|---|
| Single enroll | `POST /classes/:id/enrollments` | Body `{ studentId, enrollmentDate, note? }`. Full validation in `EnrollStudentUseCase`. |
| Atomic transfer | `POST /students/:studentId/transfer` | Body `{ toClassId, transferDate?, fromClassId?, note? }`. Returns `{ closed, opened }`. Single DB transaction. |
| Withdraw | `POST /classes/:id/enrollments/:enrollmentId/withdraw` | Body `{ reason, endDate?, note? }`. |
| List enrollments by class | `GET /classes/:id/enrollments?includeHistorical=` | Active by default; historical via flag. |
| Student enrollment history | `GET /students/:studentId/enrollments` | Cross-class history. |
| Single staff assign | `POST /classes/:id/staff` | Body `{ staffId, subjectId }`. |
| Remove staff | `DELETE /classes/:classId/staff/:staffId/subjects/:subjectId` | Per `(staff, subject)` row. |
| List staff | `GET /classes/:id/staff` | All `(staff, subject)` rows. |
| Filtered student list | `GET /students` | StandardRequest filters: `fullName`, `nickname`, `classId`, `gender`, `enrollmentDate`. |
| Bulk reference pattern | `POST /attendance/bulk` (`BulkRecordAttendanceUseCase`) | Per-row tolerant: returns `{ created[], skipped[{ studentId, reason }] }`. **Mirror this shape for bulk enroll.** |

### DB invariants (already migrated)

- `enrollment` table has `endDate`, `exitReason` columns (period model).
- Composite unique: `(studentId, classId, enrollmentDate)`.
- Partial unique index: `idx_enrollment_one_active_per_student ON enrollment (student_id) WHERE end_date IS NULL` — at most one active enrollment per student.

---

## What backend NEEDS to add

### 1. Bulk enroll — REQUIRED

**Why:** Without this, frontend would fire N parallel HTTP calls and reconcile partial failures client-side. A bulk endpoint lets backend validate the class+campus once, run per-row enrollments inside a single use case, and return one consolidated `{ enrolled, skipped }` payload.

**Endpoint**

```
POST /classes/:id/enrollments/bulk
```

**Request body**

```ts
{
  enrollmentDate: string;       // ISO date, applies to all rows
  note?: string;                // optional, applies to all rows
  students: Array<{
    studentId: string;          // UUID
    note?: string;              // optional per-row override (overrides batch note)
  }>;
}
```

`enrollmentDate` is batch-level (single date for the whole submission). If per-row dates are ever needed, hoist into the row object — keeping it batch-level matches the wizard UX.

**Response (200)**

```ts
{
  enrolled: EnrollmentResponse[];           // shape: existing EnrollmentResponse
  skipped: Array<{
    studentId: string;
    reason: string;                         // machine code, e.g. "STUDENT_ALREADY_ENROLLED"
    message?: string;                       // human-readable detail
  }>;
}
```

**Per-row validation** (port from `EnrollStudentUseCase`):

1. Class exists + same campus → if class fails, fail the **whole call** (404). Class is shared across the batch.
2. School year covers `enrollmentDate` → fail the **whole call** (400 `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`). Same reason.
3. Per row:
   - Student exists → skip with `STUDENT_NOT_FOUND`.
   - Student same campus → skip with `STUDENT_NOT_IN_CAMPUS`.
   - No active enrollment → skip with `STUDENT_ALREADY_ENROLLED` (operator can switch to bulk-transfer).
   - No exact `(student, class, date)` duplicate → skip with `ENROLLMENT_ALREADY_EXISTS_ON_DATE`.

**Why per-row tolerant rather than all-or-nothing:** Operator picks 30 students from a list; 2 might have unexpected active enrollments. Failing all 30 is hostile UX. The `bulk-record-attendance` precedent already uses this pattern.

**Persistence:** Call `enrollmentRepository.save()` per valid row inside the use case. Either persist row-by-row, or call a new `enrollmentRepository.saveMany(enrollments)` for one round trip (mirror `saveManySummariesWithLogs`).

**Limits**

- Cap `students.length` at e.g. 100 per call (class rosters max ~30–40, but headroom for safety). Reject 400 if exceeded.
- Reject empty `students[]` with 400.
- Reject duplicate `studentId` in the same payload with 400 (clean error before per-row work starts).

---

### 2. Eligible-students filter — REQUIRED

**Why:** The wizard's student-picker needs to show only students at this campus who currently have **no active enrollment**. The existing `GET /students` doesn't expose `hasActiveEnrollment` as a filterable field, and computing it client-side would require fetching every active enrollment in the campus.

**Recommended: dedicated endpoint** — clean, encapsulates rules, easy to evolve.

```
GET /classes/:classId/eligible-students
  ?search=<name fragment>     // optional, ilike on fullName
  &page=<n>&limit=<n>          // standard pagination
  &sort=<field:dir>            // standard sort
  &includeStatuses=ACTIVE,WAITING,TRIAL,DEFERRED   // optional — defaults to ACTIVE
```

**Response:** Standard paginated `Student[]` (reuse `StudentResponse`).

**Eligibility rules (server-enforced):**

- `Student.campusId === classCampusId`
- `Student.isArchived === false`
- `Student.status` ∈ `includeStatuses` (default: ACTIVE; UI may opt to include WAITING/TRIAL/DEFERRED for pre-enrollment workflows)
- No row in `Enrollment` with `studentId = s.id AND endDate IS NULL`

The class is needed in the URL (vs. just campus) so future rules can layer in (e.g., grade-level compatibility, capacity). For now the only class-derived rule is "same campus as class," but the URL shape future-proofs.

**Alternative if you'd rather not add a dedicated endpoint:** extend `GET /students` to support a synthetic filter `filter[hasActiveEnrollment][eq]=false` via a custom filter handler in the student repository's `findAll`. Less explicit but reuses existing pagination/sort.

---

### 3. Bulk transfer — RECOMMENDED, separable

**Why:** Same wizard, but for moving N students who already have active enrollments into a target class. Without this, the wizard either blocks those rows (skipped) or operator runs single transfers N times.

**Endpoint**

```
POST /classes/:id/transfers/bulk
```

**Request body**

```ts
{
  transferDate: string;          // ISO date, applies to all rows
  note?: string;
  students: Array<{
    studentId: string;
    fromClassId?: string;        // optional source-mismatch guard (per existing TransferStudentUseCase)
    note?: string;
  }>;
}
```

**Response (200)**

```ts
{
  transferred: Array<{ closed: EnrollmentResponse; opened: EnrollmentResponse }>;
  skipped: Array<{ studentId: string; reason: string; message?: string }>;
}
```

**Per-row validation** (port from `TransferStudentUseCase`):

- Target class same campus → whole-call 404 if fails.
- `transferDate` within target school year → whole-call 400.
- Per row:
  - Student has active enrollment → otherwise skip `NO_ACTIVE_ENROLLMENT`.
  - `fromClassId` matches active (if provided) → skip `TRANSFER_SOURCE_MISMATCH`.
  - Active class ≠ target → skip `TRANSFER_SAME_CLASS`.

**Atomicity:** Each transfer (close+open) **must** run inside its own DB transaction (existing `enrollmentRepository.transferEnrollment` already does this). Different rows are independent — partial-batch success is fine and matches the per-row-tolerant contract.

This can ship after #1; not a blocker for the first wizard release if "transfer mode" is gated/optional.

---

### 4. Bulk staff assign — OPTIONAL, complementary

**Why:** Same shape as the student bulk endpoints, for the parallel "assign N staff to a class" flow. Lower priority — single-row already works and staff rosters are small.

**Endpoint**

```
POST /classes/:id/staff/bulk
```

**Request body**

```ts
{
  assignments: Array<{
    staffId: string;
    subjectId: string;
  }>;
}
```

**Response**

```ts
{
  assigned: ClassStaffResponse[];
  skipped: Array<{ staffId: string; subjectId: string; reason: string }>;
}
```

**Per-row validation:**

- Class exists + same campus (whole-call gate).
- Per row:
  - Staff exists + same campus → skip otherwise.
  - Subject exists + same campus → skip otherwise.
  - `(class, staff, subject)` row doesn't already exist (composite PK collision) → skip `ASSIGNMENT_ALREADY_EXISTS`.

Defer until staff bulk-add is on the roadmap. Single endpoint covers the typical "assign one teacher to one new subject" flow.

---

## Suggested error-code dictionary

Stable machine codes for the `skipped[].reason` field — frontend will map these to user-facing messages.

| Code | Meaning |
|---|---|
| `STUDENT_NOT_FOUND` | studentId does not exist |
| `STUDENT_NOT_IN_CAMPUS` | student belongs to a different campus |
| `STUDENT_ALREADY_ENROLLED` | student has an active enrollment elsewhere |
| `ENROLLMENT_ALREADY_EXISTS_ON_DATE` | exact `(student, class, date)` row already exists |
| `STAFF_NOT_FOUND` | (staff bulk) |
| `STAFF_NOT_IN_CAMPUS` | (staff bulk) |
| `SUBJECT_NOT_FOUND` | (staff bulk) |
| `ASSIGNMENT_ALREADY_EXISTS` | (staff bulk) `(class, staff, subject)` row already exists |
| `NO_ACTIVE_ENROLLMENT` | (bulk transfer) student has no row to close |
| `TRANSFER_SOURCE_MISMATCH` | (bulk transfer) `fromClassId` ≠ active class |
| `TRANSFER_SAME_CLASS` | (bulk transfer) target = active class |

Whole-call errors (HTTP 4xx, not in `skipped[]`):

- `404 CLASS_NOT_FOUND` — class doesn't exist or wrong campus
- `400 ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR` — date outside target class's school year
- `400 BATCH_TOO_LARGE` — students[] exceeds cap
- `400 BATCH_EMPTY` — students[] empty
- `400 DUPLICATE_STUDENT_IN_BATCH` — same studentId twice in payload

---

## Test scenarios (suggested)

**Bulk enroll — happy path**
- 5 valid students, all enrolled. Response: `{ enrolled: [5], skipped: [] }`. DB: 5 rows in `enrollment` with `endDate = null`.

**Bulk enroll — mixed batch**
- 3 valid + 1 already-enrolled + 1 cross-campus. Response: `enrolled: [3], skipped: [2]` with codes `STUDENT_ALREADY_ENROLLED` and `STUDENT_NOT_IN_CAMPUS`.

**Bulk enroll — all skipped**
- All 5 students already enrolled. Response: `enrolled: [], skipped: [5]`. HTTP 200 (per-row tolerant).

**Bulk enroll — whole-call fail**
- Class doesn't exist → 404. Class belongs to other campus → 404. Date outside school year → 400. No row work performed.

**Bulk enroll — limits**
- 101 students → 400 `BATCH_TOO_LARGE`. Empty array → 400 `BATCH_EMPTY`. Duplicate `studentId` → 400 `DUPLICATE_STUDENT_IN_BATCH`.

**Bulk transfer — happy path**
- 4 students with active enrollments in class A → bulk transfer to class B. All transferred atomically (per row). Response: `transferred: [4], skipped: []`. Each closed row has `exitReason = TRANSFERRED`.

**Bulk transfer — transactional safety**
- Force a DB error mid-batch (e.g., a row mid-transaction) → only the failing row's transaction rolls back; previously-committed rows persist. Verify `enrollment` table doesn't have partial close-without-open or open-without-close.

**Eligible-students endpoint**
- Class A in campus X. Search returns campus-X students with `endDate IS NULL` rowless. Doesn't include archived. Doesn't include other-campus students. Doesn't include students currently active anywhere.

---

## References (existing files to mirror)

- `src/application/attendance/use-cases/bulk-record-attendance.use-case.ts` — the canonical bulk pattern to follow.
- `src/infra/http/dtos/attendance/bulk-record-attendance.request.ts` — DTO shape with `class-validator` + nested `ValidateNested`.
- `src/application/class-management/use-cases/enrollment/enroll-student.use-case.ts` — single-row validation chain to port per-row.
- `src/application/class-management/use-cases/enrollment/transfer-student.use-case.ts` — atomic-transaction reference for `transferEnrollment` repo method.
- `src/application/class-management/ports/enrollment.repository.ts` — extend with `saveMany(enrollments)` for fewer round trips.
- `prisma/schema.prisma:525-549` — `Enrollment` model, composite unique, partial active index.
- `src/domain/class-management/entities/enrollment.entity.ts` — domain invariants (XOR `endDate`/`exitReason`, date-only comparisons).

---

## Order of operations

Backend can ship in this order without blocking each other:

1. **Bulk enroll** + **Eligible-students** — both required for v1 wizard. Ship together.
2. **Bulk transfer** — unlocks "transfer mode" toggle in the wizard.
3. **Bulk staff** — defer until a parallel staff-bulk wizard is on the roadmap.

Frontend can stub the wizard against the contracts in this doc; merging frontend before backend lands works as long as the contracts don't drift.

---

## Frontend plan once backend ships

For reference (not part of backend scope):

1. Extend `class.service.ts`: `bulkEnroll(classId, payload)`, `bulkTransfer(classId, payload)`, `getEligibleStudents(classId, params)`.
2. Add hooks: `useBulkEnroll`, `useBulkTransfer`, `useEligibleStudents`.
3. Build wizard component under `src/features/classes/components/bulk-enrollment-wizard/` — multi-step shadcn `Dialog` with `Tabs` or stepper primitive.
4. Entry points: "Add students" pill in `ClassProfileHero` (already deferred per current spec D3), and an action menu item from the class list.
5. Per-row result UI: success rows checkmarked, skipped rows show the reason from the error-code dictionary above.
6. Cache invalidation: on success, invalidate `classKeys.enrollments(classId, *)` and `classKeys.detail(classId)`.
