---
id: q9gt2v
title: Domain entity — endDate, exitReason, withdraw(), invariants
status: done
priority: high
labels:
  - from-spec
  - domain
createdAt: '2026-05-05T23:32:58.410Z'
updatedAt: '2026-05-06T01:57:15.947Z'
timeSpent: 375
assignee: '@me'
spec: specs/class-enrollment-period-model
fulfills:
  - AC-5
  - AC-6
  - AC-7
  - AC-8
---
# Domain entity — endDate, exitReason, withdraw(), invariants

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend `Enrollment` entity in `src/domain/class-management/entities/enrollment.entity.ts` with `endDate: Date | null` and `exitReason: ExitReason | null`. Add `ExitReason` enum (`TRANSFERRED | WITHDRAWN | COMPLETED | GRADUATED`). Implement `isActive()` returning `endDate === null`. Implement immutable `withdraw(date, reason)` returning a new entity instance. Enforce constructor invariant: `endDate` and `exitReason` must both be null or both set. Add domain errors `EnrollmentAlreadyClosedError` and `InvalidEndDateError`.

Spec: @doc/specs/class-enrollment-period-model
Covers: FR-3, FR-4, FR-5, FR-6
Blocked by: Task 1 (schema migration)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `ExitReason` enum added with values `TRANSFERRED | WITHDRAWN | COMPLETED | GRADUATED`
- [x] #2 `Enrollment.isActive()` returns `true` iff `endDate === null`
- [x] #3 `Enrollment.withdraw(date, reason)` returns a new entity instance with `endDate=date, exitReason=reason` (immutable)
- [x] #4 Calling `withdraw()` on an already-closed entity throws `EnrollmentAlreadyClosedError`
- [x] #5 `withdraw()` with `date < enrollmentDate` or `date > today` throws `InvalidEndDateError`
- [x] #6 Constructor enforces XOR invariant: `endDate` and `exitReason` must both be null or both set; otherwise throw
- [x] #7 Unit tests in `enrollment.entity.spec.ts` cover `isActive`, `withdraw` happy path, all withdraw error paths, and the constructor invariant
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

Extend the `Enrollment` domain entity with period semantics. Convention deviations from the task description: project uses `*.exception.ts` (suffix `Exception`) and `<area>/enums/`, `<area>/exceptions/` folders — I'll use `EnrollmentAlreadyClosedException` and `InvalidEndDateException` instead of the `Error` suffix mentioned in the description (HTTP error codes `ENROLLMENT_ALREADY_CLOSED` / `INVALID_END_DATE` are mapped at the use-case/controller layer in tasks @task-q0oqvy and @task-q9rt9n, not here).

### Step 1 — Add `ExitReason` enum
- Create `src/domain/class-management/enums/exit-reason.enum.ts` with values `TRANSFERRED | WITHDRAWN | COMPLETED | GRADUATED` (PascalCase enum, SCREAMING_SNAKE_CASE values — matches `student-status.enum.ts` convention).
- Create `src/domain/class-management/enums/index.ts` barrel.

### Step 2 — Add domain exceptions
- Create `src/domain/class-management/exceptions/enrollment-already-closed.exception.ts` — extends `Error`, takes `enrollmentId: string`.
- Create `src/domain/class-management/exceptions/invalid-end-date.exception.ts` — extends `Error`, takes a contextual reason message (used for both "date < enrollmentDate" and "date > today").
- Create `src/domain/class-management/exceptions/index.ts` barrel.
- Pattern reference: `src/domain/user-management/exceptions/email-already-exists.exception.ts`.

### Step 3 — Extend `Enrollment` entity (props, getters, factory invariant)
File: `src/domain/class-management/entities/enrollment.entity.ts`
- Add `endDate: Date | null` and `exitReason: ExitReason | null` to `EnrollmentProps`.
- Add matching getters.
- Add `isActive(): boolean` returning `this.props.endDate === null`.
- In `Enrollment.create()`, default missing `endDate`/`exitReason` to `null` (keeps existing mapper call sites working until @task-jvdbpl updates the mapper).
- Enforce XOR invariant: if exactly one of `endDate`/`exitReason` is non-null, throw `Error("Enrollment endDate and exitReason must both be set or both be null")`. Used by both factory and `withdraw()` reconstruction path.

### Step 4 — Implement immutable `withdraw(date, reason)`
- Throws `EnrollmentAlreadyClosedException` if `!isActive()`.
- Validates `date >= enrollmentDate` and `date <= today` (compare on date components, not time-of-day) — throws `InvalidEndDateException` otherwise.
- Returns a NEW `Enrollment` instance via `Enrollment.create({ ...this.props, endDate, exitReason })` preserving the same `id` (pass `this.id` as the second arg) so identity is stable across the immutable transition.
- The current entity instance is left untouched (immutability check via test).

### Step 5 — Unit tests
- Create `src/domain/class-management/entities/enrollment.entity.spec.ts` mirroring the style of `class.entity.spec.ts`.
- Coverage:
  - `isActive()` — true when `endDate=null`, false when set.
  - `withdraw()` happy path — returns new instance with `endDate`, `exitReason` set; original instance unchanged; new instance has same `id`.
  - `withdraw()` error paths — already-closed throws `EnrollmentAlreadyClosedException`; date before `enrollmentDate` throws `InvalidEndDateException`; date in future throws `InvalidEndDateException`.
  - Constructor invariant — `create({ endDate: someDate })` (no reason) throws; `create({ exitReason: ExitReason.WITHDRAWN })` (no date) throws; both null OK; both set OK.
- Run `npx jest src/domain/class-management/entities/enrollment.entity.spec.ts`.

### Step 6 — Wire exports & validate
- Update `src/domain/class-management/index.ts` to re-export `enums` and `exceptions` barrels.
- Run `npx tsc --noEmit` to confirm no breakage in mapper/use-cases that call `Enrollment.create(...)`.
- Run full enrollment-related test suite: `npx jest src/application/class-management/use-cases/enrollment` and `src/domain/class-management`.
- Run Knowns validation on this task.

### Out of scope (handled in dependent tasks)
- Mapper updates for `endDate`/`exitReason` — @task-jvdbpl
- HTTP layer mapping domain exceptions → `409 ENROLLMENT_ALREADY_CLOSED` / `400 INVALID_END_DATE` — @task-q0oqvy
- Use-case enforcement of "active-only" mutations on `update()` — @task-q0oqvy / @task-zffh6i

### AC ↔ Step mapping
| Task AC | Step |
|---|---|
| ExitReason enum added | 1 |
| isActive() returns true iff endDate null | 3 |
| withdraw() immutable returns new entity | 4 |
| Already-closed throws EnrollmentAlreadyClosedException | 4 |
| date < enrollmentDate or > today throws InvalidEndDateException | 4 |
| Constructor XOR invariant | 3 |
| Unit tests cover all of the above | 5 |

| Spec AC | Step |
|---|---|
| AC-5 | 3 |
| AC-6 | 3, 4 |
| AC-7 | 3 |
| AC-8 | 4 |
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation complete (2026-05-05).

**Files created**
- src/domain/class-management/enums/exit-reason.enum.ts — `ExitReason` enum with TRANSFERRED|WITHDRAWN|COMPLETED|GRADUATED.
- src/domain/class-management/enums/index.ts — barrel.
- src/domain/class-management/exceptions/enrollment-already-closed.exception.ts — `EnrollmentAlreadyClosedException` (extends Error, takes enrollmentId).
- src/domain/class-management/exceptions/invalid-end-date.exception.ts — `InvalidEndDateException` (extends Error, takes contextual reason string).
- src/domain/class-management/exceptions/index.ts — barrel.
- src/domain/class-management/entities/enrollment.entity.spec.ts — 17 unit tests (all green).

**Files modified**
- src/domain/class-management/entities/enrollment.entity.ts — added `endDate`/`exitReason` props + getters, `isActive()`, immutable `withdraw(date, reason)`, XOR factory invariant, private `toDateOnly()` for date-only comparisons.
- src/domain/class-management/index.ts — re-exports `enums` and `exceptions` barrels.

**Convention deviation from task description (decided in plan, kept):** Used *.exception.ts / `Exception` suffix per @doc/patterns/exception-pattern and @doc/conventions/naming-conventions rather than the spec's textual `*Error` suffix. HTTP error codes `ENROLLMENT_ALREADY_CLOSED` / `INVALID_END_DATE` are still mapped at the use-case/controller layer in @task-q0oqvy and @task-q9rt9n.

**Backwards compatibility:** `Enrollment.create()` defaults `endDate`/`exitReason` to `null`. Existing call sites (`PrismaEnrollmentMapper.toDomain`, `EnrollStudentUseCase`) continue to work without modification — the mapper update lands in @task-jvdbpl.

**Verification**
- npx jest src/domain/class-management/entities/enrollment.entity.spec.ts → 17 passed.
- npx jest src/application/class-management/use-cases/enrollment src/domain/class-management → 38 passed (no regressions).
- npx tsc --noEmit → clean.

**SOLID compliance**
- SRP: enum + each exception + entity each in their own file with one responsibility.
- OCP: `withdraw()` returns a new instance instead of mutating, so the entity is open for extension via composition without modifying the existing `update()` flow.
- LSP: subclass behavior matches `Entity<Props>` base — no behavioral surprises.
- ISP: `UpdateEnrollmentData` and `CreateEnrollmentData` types narrow what callers may pass.
- DIP: domain layer depends only on `Entity`, `UniqueEntityID`, `Optional` (core abstractions) — no Nest/Prisma. Exceptions extend the language `Error` only.
<!-- SECTION:NOTES:END -->

