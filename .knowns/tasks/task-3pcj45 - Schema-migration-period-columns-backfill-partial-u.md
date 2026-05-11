---
id: 3pcj45
title: Schema migration — period columns, backfill, partial unique index
status: done
priority: high
labels:
  - from-spec
  - schema
  - migration
createdAt: '2026-05-05T23:32:53.464Z'
updatedAt: '2026-05-06T01:43:34.764Z'
timeSpent: 6732
assignee: '@me'
spec: specs/class-enrollment-period-model
fulfills:
  - AC-1
  - AC-2
  - AC-3
  - AC-4
---
# Schema migration — period columns, backfill, partial unique index

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Single Prisma migration `add_enrollment_period_columns` adding `end_date date null` and `exit_reason text null`, deterministic backfill via LEAD window function (chains `(studentId, classId)` periods, sets non-latest rows to `endDate = next.start - 1 day`, `exitReason = COMPLETED`), conflict-detection probe that aborts and prints a report on simultaneous active enrollments across classes, and the partial unique index `idx_enrollment_one_active_per_student ON enrollment (student_id) WHERE end_date IS NULL` via raw SQL. All steps in one transaction. Down migration drops both columns and the index.

Spec: @doc/specs/class-enrollment-period-model
Covers: FR-1, FR-2, NFR-1, NFR-2, NFR-7
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Migration adds `end_date date null` and `exit_reason text null` columns plus the partial unique index `idx_enrollment_one_active_per_student` in a single transaction
- [x] #2 Backfill via LEAD window function closes non-latest `(studentId, classId)` rows with `endDate = next.start - 1 day` and `exitReason = COMPLETED`; latest row stays open
- [x] #3 Conflict-detection probe (rowcount > 0 from simultaneous active group-by) raises an exception printing `studentId | classIds | enrollmentDates` and rolls back the transaction
- [x] #4 Down migration drops the partial index and both columns cleanly
- [x] #5 Migration test against synthetic conflict data verifies abort + unchanged DB state
- [x] #6 Test inserting two `endDate IS NULL` rows for one student raises a unique-constraint violation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update prisma/schema.prisma — add `endDate: DateTime? @map("end_date") @db.Date` and `exitReason: String? @map("exit_reason")` fields to Enrollment model. Add a comment noting the partial unique index `idx_enrollment_one_active_per_student` is applied via raw SQL only (Prisma cannot natively express partial unique indexes).

2. Generate the migration scaffold: `npx prisma migrate dev --create-only --name add_enrollment_period_columns` to capture Prisma's auto-generated ALTER TABLE statements.

3. Hand-author the rest of migration.sql in order (Prisma wraps each migration file in an implicit transaction; no explicit BEGIN/COMMIT needed, satisfies "all in one transaction"):
   a. ALTER TABLE additions (from scaffold)
   b. Backfill via CTE + LEAD window function — sets non-latest rows in each (student_id, class_id) group to `end_date = next.start - INTERVAL '1 day'`, `exit_reason = 'COMPLETED'`. Latest row stays open.
   c. PL/pgSQL `DO $$ ... END $$;` block: probe `SELECT student_id, array_agg(class_id), array_agg(enrollment_date) FROM enrollment WHERE end_date IS NULL GROUP BY student_id HAVING count(*) > 1`, build conflict report, `RAISE EXCEPTION 'CONFLICT: ...'` on rowcount > 0 to roll the transaction back.
   d. `CREATE UNIQUE INDEX idx_enrollment_one_active_per_student ON enrollment (student_id) WHERE end_date IS NULL`.

4. Document the down migration as a commented inverse-SQL block at the bottom of migration.sql (DROP INDEX + DROP COLUMN ×2). Project convention has no separate down-migration files; this matches existing patterns (see @doc/conventions/implementation-checklist) and satisfies NFR-1.

5. Add a synthetic seed script `prisma/seeds/seed-enrollment-migration-test.ts` that builds three scenarios in a clean DB: (i) chained periods for one (student, class) pair (validates backfill), (ii) single open enrollment (validates "latest stays open"), (iii) one student active in two different classes simultaneously (validates conflict abort). Wire as a one-off run via `ts-node`, NOT into the main seed pipeline.

6. Manual verification checklist (project is pre-prod, no e2e infrastructure; use this in lieu of automated migration tests):
   a. Reset dev DB: `npx prisma migrate reset --skip-seed` then run scenario (i)+(ii) seed → run `npx prisma migrate dev` → verify: `\d enrollment` shows the two new columns + partial index; backfilled rows have `end_date = next.start - 1 day`, `exit_reason = 'COMPLETED'`; latest row of each chain has `end_date IS NULL`. (covers AC-1, AC-2)
   b. Reset DB → run scenario (iii) conflict seed → run migration → verify it aborts with conflict report `student_id | classIds | enrollmentDates`, transaction rolled back, columns/index NOT present. (covers AC-3)
   c. After successful migration (from 6a), run raw SQL `INSERT INTO enrollment (...) VALUES (...) WITH end_date = NULL` for the same student twice → verify the second insert raises a unique-constraint violation on `idx_enrollment_one_active_per_student`. (covers AC-4)
   d. Test down: apply commented inverse SQL via `psql` → re-run forward migration → verify clean re-apply. (covers NFR-1)
   Capture command output + `\d enrollment` snippets in the task implementation notes as verification evidence.

7. Update related docs:
   - Brief note in @doc/architecture/audit-trail-soft-delete-patterns introducing the period-with-exit-reason pattern as a precedent for future history modeling.
   - Note in @doc/conventions/implementation-checklist that partial unique indexes and PL/pgSQL conflict probes are valid migration tools (first use).

Spec: @doc/specs/class-enrollment-period-model
Refs: @doc/conventions/implementation-checklist, @doc/architecture/audit-trail-soft-delete-patterns

Confirmed assumptions (per user, 2026-05-05):
- No e2e/integration test infrastructure for migrations — manual checklist replaces automated tests.
- Pre-production: no prod snapshot, no production-shape seed available — synthetic scenarios from step 5 are the verification source of truth.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation status

Files written:
- `prisma/schema.prisma:525` — Enrollment model gains `endDate: DateTime? @db.Date` and `exitReason: String?`. Comment notes the partial unique index lives in raw SQL only.
- `prisma/migrations/20260505160000_add_enrollment_period_columns/migration.sql` — column adds, CTE+LEAD backfill (`next.start - 1` integer date arithmetic, returns DATE cleanly), PL/pgSQL `DO $$ ... END $$;` conflict probe with `RAISE EXCEPTION` rollback, partial unique index. Down migration documented inline as a commented psql block.
- `prisma/seeds/seed-enrollment-migration-test.ts` — synthetic seed using raw SQL inserts (schema-state agnostic). Three scenarios: `chained`, `single-open`, `conflict`, plus `all` (chained + single-open).

`npx prisma validate` passes.

## Manual verification checklist (per-AC)

> The verification flow temporarily moves the new migration directory out of `prisma/migrations/` so `migrate reset` applies only prior migrations. Reset is destructive — run only against the dev DB.

### AC-1, AC-2 — columns + index added; backfill chains correctly

```bash
mv prisma/migrations/20260505160000_add_enrollment_period_columns /tmp/
npx prisma migrate reset --skip-seed --force
npx ts-node -r tsconfig-paths/register prisma/seeds/seed-enrollment-migration-test.ts all
mv /tmp/20260505160000_add_enrollment_period_columns prisma/migrations/
npx prisma migrate dev
psql "$DATABASE_URL" -c '\d enrollment'
psql "$DATABASE_URL" -c "SELECT student_id, class_id, enrollment_date, end_date, exit_reason FROM enrollment WHERE student_id IN ('ee000000-0000-4000-8000-000000000010','ee000000-0000-4000-8000-000000000011') ORDER BY student_id, enrollment_date;"
```

Expected:
- `\d enrollment` shows `end_date date`, `exit_reason text`, and `idx_enrollment_one_active_per_student` (partial, predicate `(end_date IS NULL)`).
- Chained student (`...010`): row1 `end_date=2026-03-31, exit_reason=COMPLETED`; row2 `end_date=2026-06-30, exit_reason=COMPLETED`; row3 `end_date=NULL, exit_reason=NULL`.
- Single-open student (`...011`): one row with `end_date=NULL, exit_reason=NULL`.

### AC-3 — conflict abort + rollback

```bash
mv prisma/migrations/20260505160000_add_enrollment_period_columns /tmp/
npx prisma migrate reset --skip-seed --force
npx ts-node -r tsconfig-paths/register prisma/seeds/seed-enrollment-migration-test.ts conflict
mv /tmp/20260505160000_add_enrollment_period_columns prisma/migrations/
npx prisma migrate dev   # expected: FAILS with conflict report
psql "$DATABASE_URL" -c '\d enrollment'   # expected: NO end_date / exit_reason / partial index
```

Expected migration failure output: `CONFLICT: 1 student(s) have simultaneous active enrollments in multiple classes. Migration aborted.` followed by the per-student report line `<uuid> | <classA>,<classB> | 2026-01-10,2026-01-15`.

### AC-4 — double-NULL insert raises unique-constraint violation

After successful migration (post AC-1/2 run):

```bash
psql "$DATABASE_URL" <<'SQL'
INSERT INTO enrollment (id, class_id, student_id, enrollment_date)
VALUES (gen_random_uuid(),
        'ee000000-0000-4000-8000-00000000000b',
        'ee000000-0000-4000-8000-000000000011',
        CURRENT_DATE);
SQL
```

Expected: `ERROR: duplicate key value violates unique constraint "idx_enrollment_one_active_per_student"` (the seed left student `...011` already active in classA).

### NFR-1 — down migration restores prior shape

After AC-1/2 verification, apply the down block from the bottom of `migration.sql`:

```bash
psql "$DATABASE_URL" <<'SQL'
DROP INDEX IF EXISTS "idx_enrollment_one_active_per_student";
ALTER TABLE "enrollment" DROP COLUMN IF EXISTS "exit_reason";
ALTER TABLE "enrollment" DROP COLUMN IF EXISTS "end_date";
SQL
psql "$DATABASE_URL" -c '\d enrollment'   # expected: no new columns / index
```

## Step 7 (doc updates) deferred

The plan called for notes in `architecture/audit-trail-soft-delete-patterns` and `conventions/implementation-checklist`. Deferred because:
- `audit-trail-soft-delete-patterns` is thematically about soft-delete, not migration tooling — the partial-index/PL-pgSQL probe doesn't fit there.
- The "period-with-exit-reason" architectural pattern is best documented after the entity (task `q9gt2v`) and use cases (`q0oqvy`, `q9rt9n`) land — at which point a dedicated `architecture/enrollment-lifecycle` doc or kn-extract pass is warranted.

ACs not yet checked — verification commands above must be executed against the dev DB before marking done.
## Verification evidence (2026-05-05)

Ran the full manual verification flow against local dev DB (`postgresql://localhost:5432/nestjs_boilerplate`). `psql` not on PATH, so wrote three one-shot ts-node verification scripts under `prisma/seeds/`. All checks passed.

### AC-1 (columns + partial index added) — PASS

```
column_name | data_type | is_nullable
end_date    | date      | YES
exit_reason | text      | YES

idx_enrollment_one_active_per_student
  CREATE UNIQUE INDEX idx_enrollment_one_active_per_student
    ON public.enrollment USING btree (student_id) WHERE (end_date IS NULL)
```

### AC-2 (backfill chains correctly) — PASS

```
student_id (chained ...010) | enrollment_date | end_date   | exit_reason
                            | 2026-01-15      | 2026-03-31 | COMPLETED
                            | 2026-04-01      | 2026-06-30 | COMPLETED
                            | 2026-07-01      | NULL       | NULL

student_id (single ...011)  | 2026-02-01      | NULL       | NULL
```

Non-latest rows closed with `next.start - 1`. Latest row of each chain stays open.

### AC-3 (conflict abort + rollback) — PASS

Migration aborted with the expected `RAISE EXCEPTION` from PL/pgSQL:

```
ERROR: CONFLICT: 1 student(s) have simultaneous active enrollments in multiple classes. Migration aborted.
student_id | classIds | enrollmentDates
ee000000-0000-4000-8000-000000000012 | ee000000-0000-4000-8000-00000000000a,ee000000-0000-4000-8000-00000000000b | 2026-01-10,2026-01-15
```

Post-failure schema check confirms full rollback: `end_date`, `exit_reason`, and `idx_enrollment_one_active_per_student` are NOT present in the table after the failed migration.

### AC-4 (double-active insert raises unique violation) — PASS

```
PASS: unique-constraint violation as expected.
  code: 23505
  message: Key (student_id)=(ee000000-0000-4000-8000-000000000011) already exists.
```

### AC-5/AC-6 (verification harness exists) — PASS

The three task ACs about "Migration test against synthetic conflict data" and "Test inserting two endDate IS NULL rows" are satisfied by:
- `prisma/seeds/seed-enrollment-migration-test.ts` (the seed-with-scenarios harness)
- `prisma/seeds/verify-enrollment-migration.ts` (AC-1 + AC-2 schema/backfill checks)
- `prisma/seeds/verify-ac4-unique-violation.ts` (AC-4 unique-violation check)
- `prisma/seeds/verify-nfr1-down-migration.ts` (NFR-1 down-migration check)

These scripts are re-runnable for future regression checks against the migration.

### NFR-1 (down migration cleanly drops shape) — PASS

```
Pre-down state:  columns: [ 'end_date', 'exit_reason' ], partial index exists: true
Post-down state: columns: [],                            partial index exists: false
PASS: down migration drops both columns and the partial index cleanly.
```

Forward SQL re-applied at end of script to leave DB in migrated state.

### Final DB state

DB has migration `20260505160000_add_enrollment_period_columns` applied; tables empty (was reset for the verification cycles). Run `npx prisma db seed` if you want the standard dev seed back.
<!-- SECTION:NOTES:END -->

