-- Migration: add_enrollment_period_columns
-- Spec: @doc/specs/class-enrollment-period-model
--
-- Models enrollment as a period: start (existing) + optional end + optional exit reason.
-- Backfill chains existing (student_id, class_id) groups so non-latest rows are closed
-- with end_date = next.start - 1 day, exit_reason = 'COMPLETED'. Latest row stays open.
-- A partial unique index enforces "one active class per student at a time".
--
-- Prisma wraps this entire file in an implicit transaction on PostgreSQL, so the
-- RAISE EXCEPTION in step 3 rolls back the column adds and backfill atomically
-- (NFR-2: migration aborts loudly on conflict; database left unchanged).

-- ============================================
-- 1. Add nullable columns
-- ============================================
ALTER TABLE "enrollment" ADD COLUMN "end_date" DATE;
ALTER TABLE "enrollment" ADD COLUMN "exit_reason" TEXT;

-- ============================================
-- 2. Backfill: chain (student_id, class_id) periods by enrollment_date
--    Non-latest rows get end_date = next.start - 1 day, exit_reason = 'COMPLETED'.
--    Latest row of each chain keeps end_date = NULL.
-- ============================================
WITH ranked AS (
  SELECT id,
         student_id,
         class_id,
         enrollment_date,
         LEAD(enrollment_date) OVER (
           PARTITION BY student_id, class_id
           ORDER BY enrollment_date
         ) AS next_start
  FROM "enrollment"
)
UPDATE "enrollment" e
SET end_date    = ranked.next_start - 1,
    exit_reason = 'COMPLETED'
FROM ranked
WHERE e.id = ranked.id
  AND ranked.next_start IS NOT NULL;

-- ============================================
-- 3. Conflict detection: abort if any student has multiple simultaneous active enrollments
--    across different classes. Required because step 4 creates a partial unique index
--    that would otherwise fail with a less informative error.
-- ============================================
DO $$
DECLARE
  conflict_count INTEGER;
  conflict_report TEXT;
BEGIN
  SELECT count(*) INTO conflict_count
  FROM (
    SELECT student_id
    FROM "enrollment"
    WHERE end_date IS NULL
    GROUP BY student_id
    HAVING count(*) > 1
  ) c;

  IF conflict_count > 0 THEN
    SELECT string_agg(
             student_id::text || ' | ' ||
             array_to_string(class_ids, ',') || ' | ' ||
             array_to_string(enrollment_dates, ','),
             E'\n'
           )
    INTO conflict_report
    FROM (
      SELECT student_id,
             array_agg(class_id) AS class_ids,
             array_agg(enrollment_date) AS enrollment_dates
      FROM "enrollment"
      WHERE end_date IS NULL
      GROUP BY student_id
      HAVING count(*) > 1
    ) c;

    RAISE EXCEPTION E'CONFLICT: % student(s) have simultaneous active enrollments in multiple classes. Migration aborted.\nstudent_id | classIds | enrollmentDates\n%',
      conflict_count, conflict_report;
  END IF;
END $$;

-- ============================================
-- 4. Partial unique index: one active enrollment per student (DB-enforced)
-- ============================================
CREATE UNIQUE INDEX "idx_enrollment_one_active_per_student"
  ON "enrollment" (student_id)
  WHERE end_date IS NULL;

-- ============================================
-- DOWN MIGRATION (manual rollback reference — Prisma has no native down support)
--
-- If a rollback is required, apply the following via psql against the target DB:
--
--   DROP INDEX IF EXISTS "idx_enrollment_one_active_per_student";
--   ALTER TABLE "enrollment" DROP COLUMN IF EXISTS "exit_reason";
--   ALTER TABLE "enrollment" DROP COLUMN IF EXISTS "end_date";
--
-- After applying the rollback, also revert the schema.prisma change
-- (remove the endDate / exitReason fields from the Enrollment model)
-- and run `npx prisma generate` to refresh the Prisma client.
--
-- Note: Active rows are unaffected by rollback. Closed rows lose their
-- end_date / exit_reason values — acceptable per spec NFR-1, since rolling
-- back means abandoning the period model entirely.
-- ============================================
