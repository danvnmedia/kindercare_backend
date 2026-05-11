---
id: h8t9p8
title: Add bulk-enrollment error-code constants module
status: done
priority: medium
labels:
  - from-spec
  - backend
  - class-management
  - bulk-enrollment
  - foundation
createdAt: '2026-05-10T19:41:55.981Z'
updatedAt: '2026-05-10T19:58:03.579Z'
timeSpent: 317
assignee: '@me'
spec: specs/bulk-enrollment
fulfills:
  - AC-19
---
# Add bulk-enrollment error-code constants module

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create `src/application/class-management/enrollment-error-codes.ts` exporting the 6 new bulk-only codes per D4 of the spec: BATCH_TOO_LARGE, BATCH_EMPTY, DUPLICATE_STUDENT_IN_BATCH, STUDENT_NOT_FOUND, STUDENT_NOT_IN_CAMPUS, ENROLLMENT_ALREADY_EXISTS_ON_DATE. Existing single-row error codes (STUDENT_ALREADY_ENROLLED, NO_ACTIVE_ENROLLMENT, TRANSFER_SAME_CLASS, TRANSFER_SOURCE_MISMATCH, ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR) stay inline per D4. Bulk use cases (Bulk Enroll, Bulk Transfer) will import from this module. Foundation task — no dependencies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 EnrollmentErrorCode const map at src/application/class-management/enrollment-error-codes.ts with the 6 keys
- [x] #2 EnrollmentErrorCode type via `keyof typeof`
- [x] #3 Build passes; module exports cleanly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Step 1 — Create the constants module
File: `src/application/class-management/enrollment-error-codes.ts`

Shape (mirrors D4 of @doc/specs/bulk-enrollment):
```ts
export const EnrollmentErrorCode = {
  BATCH_TOO_LARGE: "BATCH_TOO_LARGE",
  BATCH_EMPTY: "BATCH_EMPTY",
  DUPLICATE_STUDENT_IN_BATCH: "DUPLICATE_STUDENT_IN_BATCH",
  STUDENT_NOT_FOUND: "STUDENT_NOT_FOUND",
  STUDENT_NOT_IN_CAMPUS: "STUDENT_NOT_IN_CAMPUS",
  ENROLLMENT_ALREADY_EXISTS_ON_DATE: "ENROLLMENT_ALREADY_EXISTS_ON_DATE",
} as const;

export type EnrollmentErrorCode =
  (typeof EnrollmentErrorCode)[keyof typeof EnrollmentErrorCode];
```

Notes:
- Const + type share the identifier `EnrollmentErrorCode` (different TS namespaces) so consumers can write `EnrollmentErrorCode.BATCH_TOO_LARGE` for values and `EnrollmentErrorCode` for the typed union.
- Type derives via `keyof typeof` indexing per AC-2 — produces the literal union `"BATCH_TOO_LARGE" | ... | "ENROLLMENT_ALREADY_EXISTS_ON_DATE"`.
- One short header comment naming the source decision (D4) — no inline per-key docstrings (codes are self-describing).
- No barrel/index re-export — the module is path-imported directly by future T4 (Bulk Enroll) and T6 (Bulk Transfer). Existing `src/application/class-management/` root has no `index.ts`; not introducing one for a single foundation file.

### Step 2 — Verify build
Run `npm run build` (or equivalent `tsc --noEmit`) — must complete with zero errors. This validates AC-3 (clean export, no type errors).

### Step 3 — No consumer wiring in this task
Per spec D4, existing single-row codes (`STUDENT_ALREADY_ENROLLED`, `NO_ACTIVE_ENROLLMENT`, `TRANSFER_SAME_CLASS`, `TRANSFER_SOURCE_MISMATCH`, `ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR`) stay inline as string literals in `enroll-student.use-case.ts` and `transfer-student.use-case.ts` — do **not** migrate them. T4 (Bulk Enroll) and T6 (Bulk Transfer) will import from the new module. T5 (Eligible Students) does not need it.

### AC mapping
- AC-1 (const map with 6 keys) ← Step 1
- AC-2 (`keyof typeof` type) ← Step 1
- AC-3 (build passes) ← Step 2

### Risk
None — pure constants module, no IO, no runtime dependencies, no consumers updated this task.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented `src/application/class-management/enrollment-error-codes.ts` with the 6 bulk-only codes per D4. Const + type share identifier `EnrollmentErrorCode` using `(typeof X)[keyof typeof X]` (canonical when keys === values). Single short header JSDoc references spec D4 and explicitly notes which codes intentionally stay inline.

Verification:
- `npx tsc --noEmit -p tsconfig.json` → 0 errors
- `npm run build` (nest build) → 0 errors
- Emitted `dist/src/application/class-management/enrollment-error-codes.{js,d.ts,js.map}` with `readonly` literal-typed keys and the union-typed export

Architecture placement (Clean Architecture):
- Application layer (correct — codes are protocol-agnostic, reused by both use cases and HTTP DTOs)
- Not in domain (no business invariants)
- Not in infra/HTTP (no transport coupling)
- Flat at `src/application/class-management/` root, alongside `use-cases/` and `ports/` — no `index.ts` introduced (none existed at that level).

No consumer wiring per spec D4. T4 (Bulk Enroll) and T6 (Bulk Transfer) will import.
<!-- SECTION:NOTES:END -->

