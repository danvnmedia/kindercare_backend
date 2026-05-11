---
id: 5sey28
title: Add EnrollmentRepository.saveMany port + Prisma impl
status: done
priority: medium
labels:
  - from-spec
  - backend
  - class-management
  - bulk-enrollment
  - foundation
  - repository
createdAt: '2026-05-10T19:42:01.398Z'
updatedAt: '2026-05-10T20:29:43.436Z'
timeSpent: 802
assignee: '@me'
spec: specs/bulk-enrollment
fulfills:
  - AC-20
---
# Add EnrollmentRepository.saveMany port + Prisma impl

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend `EnrollmentRepository` port (`src/application/class-management/ports/enrollment.repository.ts`) with `saveMany(enrollments: Enrollment[]): Promise<Enrollment[]>`. Implement in `PrismaEnrollmentRepository` using a single `prisma.$transaction(async tx => ...)` looping `tx.enrollment.create` per row with `include: { class: true, student: true }`. Mirrors the `saveManySummariesWithLogs` precedent (`prisma-student-attendance.repository.ts:300-340`). Returns persisted entities in input order. A DB-level error inside the transaction rolls back the entire batch (per D3). Foundation for Bulk Enroll task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Abstract `saveMany(enrollments: Enrollment[]): Promise<Enrollment[]>` added to EnrollmentRepository port
- [x] #2 Prisma impl uses single `prisma.$transaction` looping `tx.enrollment.create` per row
- [x] #3 Each create includes `{ class: true, student: true }` to populate response relations
- [x] #4 Returns mapped domain entities in input order
- [x] #5 Spec test: happy path persists 3 rows
- [x] #6 Spec test: forced error mid-batch rolls back entire transaction (0 rows persisted)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — `saveMany` for EnrollmentRepository

### Step 1 — Extend the port (AC-1)
File: `src/application/class-management/ports/enrollment.repository.ts`
Add abstract method below `save`:
```ts
/**
 * Atomically persist a batch of new enrollments inside a single transaction.
 * Returns rows in input order. A DB-level error rolls back the entire batch.
 * Used by the bulk-enrollment use case (specs/bulk-enrollment, D3).
 */
abstract saveMany(enrollments: Enrollment[]): Promise<Enrollment[]>;
```

### Step 2 — Implement on PrismaEnrollmentRepository (AC-2, AC-3, AC-4)
File: `src/infra/persistence/prisma/repositories/prisma-enrollment.repository.ts`
Mirror the `transferEnrollment` pattern and the `saveManySummariesWithLogs` precedent (`prisma-student-attendance.repository.ts:300-340`):
```ts
async saveMany(enrollments: Enrollment[]): Promise<Enrollment[]> {
  return this.prisma.$transaction(async (tx) => {
    const results: Enrollment[] = [];
    for (const enrollment of enrollments) {
      const created = await tx.enrollment.create({
        data: PrismaEnrollmentMapper.toPrisma(enrollment),
        include: { class: true, student: true },
      });
      results.push(PrismaEnrollmentMapper.toDomain(created));
    }
    return results;
  });
}
```
- Single `$transaction` callback → automatic rollback on throw (D3).
- Loop preserves input order in the result array.
- `include: { class: true, student: true }` matches every other write in this file.

### Step 3 — Tests (AC-5, AC-6)
File: `src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts`
Add a `describe("saveMany (atomic batch insert)")` block that mirrors the existing `transferEnrollment` block layout:
- Reuses `prismaRowFactory`; introduces a local `buildEnrollment({ id, studentId })` helper using `Enrollment.create`.
- **Test A — "persists 3 rows in input order"**: `txDelegate.create` mocked sequentially per row; assert `$transaction` called once, `txDelegate.create` called 3 times, outer `enrollmentDelegate.create` never called, returned array has 3 domain entities matching input order.
- **Test B — "rolls back when a row fails mid-batch (D3)"**: first `create` resolves, second rejects with a forced error; assert promise rejects with the same error, `$transaction` called once, no writes leaked to the outer delegate (proves rollback wrapping is intact).

### Step 4 — Verify
- `npm run build` → 0 errors.
- `npx jest src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts` → all green.

---

### Pre-execution plan check
- AC coverage: AC-1 → S1; AC-2/3/4 → S2; AC-5/6 → S3. ✅ all covered.
- Scope: 3 files touched, single session. ✅
- Dependencies: additive to the port (no callers broken); foundational for `zl7xnd` Bulk Enroll. ✅
- Risk: low. No new packages, no shared-module signature breaks, tests included.

### Refs
- `@doc/specs/bulk-enrollment#locked-decisions` (D3)
- `@task-h8t9p8` (sibling foundation, done — error codes module)
- Precedent: `src/infra/persistence/prisma/repositories/prisma-student-attendance.repository.ts:300-340`
- Precedent in same repo: `transferEnrollment` (lines 174-193)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete.

**Files changed (3 source + 6 test mock-fixes):**
- `src/application/class-management/ports/enrollment.repository.ts` — added `abstract saveMany(enrollments: Enrollment[]): Promise<Enrollment[]>` with D3 contract docstring (atomic batch, input order, full rollback on any failure).
- `src/infra/persistence/prisma/repositories/prisma-enrollment.repository.ts` — implemented `saveMany` using `this.prisma.$transaction(async tx => …)` with a sequential loop calling `tx.enrollment.create({ data: PrismaEnrollmentMapper.toPrisma(e), include: { class: true, student: true } })`. Mirrors `saveManySummariesWithLogs` precedent and the in-file `transferEnrollment` pattern.
- `src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts` — added `describe("saveMany (atomic batch insert)")` with two tests: happy-path (3 rows in input order, all routed through tx delegate, correct include) + rollback (mid-loop failure propagates, loop aborts after 2 attempts, no leak to outer client).
- 6 use-case spec files patched to add `saveMany: jest.fn()` to their `jest.Mocked<EnrollmentRepository>` mock objects, since adding an abstract method to the port required all mocks to implement the new shape (cross-campus-prevention.integration.spec, enroll-student/withdraw-student/transfer-student/get-class-enrollments/get-student-enrollment-history use-case specs).

**Verification:**
- `npm run build` → 0 errors.
- `npx jest src/infra/persistence/prisma/repositories/prisma-enrollment.repository.spec.ts` → 14/14 pass (12 existing + 2 new).
- `npx jest src/application/class-management/use-cases/enrollment src/.../cross-campus-prevention.integration.spec.ts` → 6 suites / 55 tests pass.

**Clean Architecture compliance:**
- Port (abstract class) lives in application layer; impl in infra. No leakage.
- Atomicity contract is an application concern (D3) expressed in the port docstring; impl honors it via Prisma's `$transaction`. Implementations of the port that don't support transactions would need an alternative strategy, but the contract is explicit.
- SRP: `saveMany` is the single new responsibility of the port; it does not subsume `save` (single-row callers stay unchanged).
- LSP: implementation honors the contract advertised by the port (input order preserved, all-or-nothing).
- Foundation for `zl7xnd` (Bulk Enroll use case, wave 2). No use-case wiring done in this task — that's `zl7xnd`'s scope per the spec dependency graph.
<!-- SECTION:NOTES:END -->

