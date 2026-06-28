-- ============================================================================
-- Migration: drop_student_status_add_phase_view
-- ============================================================================
-- Removes the `student.status` column and replaces it with a derived `phase`
-- value exposed through the `student_with_phase` view. The view derives phase
-- from open Enrollment / open SchoolYearEnrollment / latest closed
-- SchoolYearEnrollment.exitReason. See @doc/specs/student-status-simplification
-- (D1, D2, D6, D7, D8) for the source-of-truth.
--
-- Index → view branch mapping:
--   ACTIVE     → idx_enrollment_one_active_per_student  (migration 20260505160000)
--                partial unique ON enrollment(student_id) WHERE end_date IS NULL
--   DEFERRED   → idx_sye_one_open_per_year              (migration 20260515120000)
--                partial unique ON school_year_enrollment(student_id, school_year_id)
--                WHERE exit_date IS NULL
--   GRADUATED  → idx_sye_student_exit_date_closed       (NEW, this migration)
--   WITHDRAWN     partial ON school_year_enrollment(student_id, exit_date DESC)
--                WHERE exit_date IS NOT NULL
--   WAITING    → fallback branch; no index needed (NOT EXISTS open rows)
--
-- Order-of-operations note: spec sketch lists "create view → drop column" with
-- `SELECT s.*`. That would fail because the view records `status` as a
-- dependency. We drop the column FIRST so `s.*` resolves cleanly without it.
-- Single-transaction wrapper preserves atomicity.
-- ============================================================================

BEGIN;

-- 1. Drop the legacy column + its index. Prisma auto-generates an index name
--    of the form `<table>_<column>_idx` for `@@index([status])`.
DROP INDEX IF EXISTS "student_status_idx";
ALTER TABLE "student" DROP COLUMN "status";

-- 2. New compound partial index supporting the GRADUATED / WITHDRAWN view
--    branches. Both branches order by `exit_date DESC` and look at the latest
--    closed parent per student.
CREATE INDEX "idx_sye_student_exit_date_closed"
  ON "school_year_enrollment" ("student_id", "exit_date" DESC)
  WHERE "exit_date" IS NOT NULL;

-- 3. Derived-phase view. Priority order matches spec D6:
--    ACTIVE > DEFERRED > GRADUATED > WITHDRAWN > WAITING.
--    `isArchived` is selected via `s.*` and returned alongside `phase` so the
--    archived overlay is orthogonal (D6: archived students with an open
--    enrollment still resolve to phase=ACTIVE; UI layers the overlay).
CREATE VIEW "student_with_phase" AS
SELECT
  s.*,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM "enrollment" e
      WHERE e.student_id = s.id AND e.end_date IS NULL
    ) THEN 'ACTIVE'
    WHEN EXISTS (
      SELECT 1 FROM "school_year_enrollment" sye
      JOIN "school_year" sy ON sy.id = sye.school_year_id
      WHERE sye.student_id = s.id
        AND sye.exit_date IS NULL
        AND sy.start_date > NOW()
    ) THEN 'DEFERRED'
    WHEN (
      SELECT sye.exit_reason
      FROM "school_year_enrollment" sye
      WHERE sye.student_id = s.id AND sye.exit_date IS NOT NULL
      ORDER BY sye.exit_date DESC
      LIMIT 1
    ) = 'GRADUATED' THEN 'GRADUATED'
    WHEN (
      SELECT sye.exit_reason
      FROM "school_year_enrollment" sye
      WHERE sye.student_id = s.id AND sye.exit_date IS NOT NULL
      ORDER BY sye.exit_date DESC
      LIMIT 1
    ) = 'WITHDRAWN' THEN 'WITHDRAWN'
    ELSE 'WAITING'
  END AS phase
FROM "student" s;

COMMIT;

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- BEGIN;
--   DROP VIEW IF EXISTS "student_with_phase";
--   DROP INDEX IF EXISTS "idx_sye_student_exit_date_closed";
--   ALTER TABLE "student" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'WAITING';
--   CREATE INDEX "student_status_idx" ON "student" ("status");
-- COMMIT;
-- Note: data in the dropped column is permanently lost (D8 hard cutover).
