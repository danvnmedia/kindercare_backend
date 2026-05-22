-- Migration: add_school_year_enrollment
-- Spec: @doc/specs/school-year-enrollment-model
--
-- Introduces SchoolYearEnrollment as the parent of class-level Enrollment.
-- Backfills one parent row per (student_id, school_year_id) group with
-- deterministic semantics:
--   - enrollmentDate = MIN(child.enrollment_date)
--   - gradeLevelId   = class.grade_level_id of the first chronological child
--   - exit_date/exit_reason set ONLY when every child in the group is closed
--     (exit_reason = 'COMPLETED' in that case)
-- A pre-scan aborts the migration with a printed report if any group spans
-- >= 2 distinct grade levels (D5 / spec AC-28). No silent fix-ups.
--
-- Prisma wraps this entire file in an implicit transaction on PostgreSQL, so
-- RAISE EXCEPTION in step 3 rolls back every preceding DDL/DML atomically.
-- The database is left untouched on conflict (NFR-2 mirror).
--
-- One-open-parent-per-year is enforced by a partial unique index in step 6
-- (D6 / spec AC-9). Step 5 promotes the child FK to NOT NULL after backfill.

-- ============================================
-- 1. Create parent table + base indexes
-- ============================================
-- Column defaults match the Prisma convention for the rest of this schema:
--   - id has no DB default (`@default(uuid())` is generated client-side)
--   - created_at uses CURRENT_TIMESTAMP (matches `@default(now())`)
--   - updated_at has no DB default (`@updatedAt` is client-managed)
-- The backfill in step 4 sets all three columns explicitly.
CREATE TABLE "school_year_enrollment" (
  "id"              UUID NOT NULL,
  "student_id"      UUID NOT NULL,
  "campus_id"       UUID NOT NULL,
  "school_year_id"  UUID NOT NULL,
  "grade_level_id"  UUID NOT NULL,
  "enrollment_date" DATE NOT NULL,
  "exit_date"       DATE,
  "exit_reason"     TEXT,
  "note"            TEXT,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "school_year_enrollment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_year_enrollment_student_id_idx"     ON "school_year_enrollment" ("student_id");
CREATE INDEX "school_year_enrollment_school_year_id_idx" ON "school_year_enrollment" ("school_year_id");
CREATE INDEX "school_year_enrollment_grade_level_id_idx" ON "school_year_enrollment" ("grade_level_id");
CREATE INDEX "school_year_enrollment_campus_id_idx"      ON "school_year_enrollment" ("campus_id");

ALTER TABLE "school_year_enrollment"
  ADD CONSTRAINT "school_year_enrollment_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_year_enrollment"
  ADD CONSTRAINT "school_year_enrollment_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_year_enrollment"
  ADD CONSTRAINT "school_year_enrollment_school_year_id_fkey"
    FOREIGN KEY ("school_year_id") REFERENCES "school_year"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "school_year_enrollment"
  ADD CONSTRAINT "school_year_enrollment_grade_level_id_fkey"
    FOREIGN KEY ("grade_level_id") REFERENCES "grade_level"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 2. Add nullable child FK on enrollment (so backfill can populate it)
-- ============================================
ALTER TABLE "enrollment"
  ADD COLUMN "school_year_enrollment_id" UUID;

ALTER TABLE "enrollment"
  ADD CONSTRAINT "enrollment_school_year_enrollment_id_fkey"
    FOREIGN KEY ("school_year_enrollment_id") REFERENCES "school_year_enrollment"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- 3. Conflict detection (hard-fail before any INSERTs)
--    A (student_id, class.school_year_id) group with >= 2 distinct
--    class.grade_level_id values is a data anomaly. Print every offending
--    tuple and RAISE EXCEPTION; the implicit Prisma transaction rolls back
--    steps 1+2 cleanly. No parent rows are inserted on conflict.
-- ============================================
DO $$
DECLARE
  conflict_count  INTEGER;
  conflict_report TEXT;
BEGIN
  SELECT count(*) INTO conflict_count
  FROM (
    SELECT e.student_id, c.school_year_id
    FROM "enrollment" e
    JOIN "class" c ON c.id = e.class_id
    GROUP BY e.student_id, c.school_year_id
    HAVING count(DISTINCT c.grade_level_id) > 1
  ) conflicts;

  IF conflict_count > 0 THEN
    SELECT string_agg(
             student_id::text || ' | ' ||
             school_year_id::text || ' | ' ||
             array_to_string(grade_level_ids, ','),
             E'\n'
           )
    INTO conflict_report
    FROM (
      SELECT e.student_id,
             c.school_year_id,
             array_agg(DISTINCT c.grade_level_id::text ORDER BY c.grade_level_id::text) AS grade_level_ids
      FROM "enrollment" e
      JOIN "class" c ON c.id = e.class_id
      GROUP BY e.student_id, c.school_year_id
      HAVING count(DISTINCT c.grade_level_id) > 1
    ) conflicts;

    RAISE EXCEPTION E'CONFLICT: % (student_id, school_year_id) group(s) span multiple grade levels. Migration aborted; manual reconciliation required before re-running.\nstudent_id | school_year_id | gradeLevelIds\n%',
      conflict_count, conflict_report;
  END IF;
END $$;

-- ============================================
-- 4. Backfill parent rows + populate child FK (clean-data path)
--    - One parent per (student_id, class.school_year_id).
--    - enrollment_date = MIN(child.enrollment_date).
--    - grade_level_id  = class.grade_level_id of the first chronological child
--      (DISTINCT ON ordered by enrollment_date, id).
--    - campus_id       = class.campus_id (uniform inside a group — every class
--      already lives in one campus).
--    - exit_date / exit_reason set ONLY when every child is closed
--      (bool_and(end_date IS NOT NULL)); otherwise parent stays open.
--    - created_at / updated_at set explicitly per project pattern (raw SQL
--      INSERTs must not rely on @updatedAt for prisma models).
-- ============================================
WITH grouped AS (
  SELECT DISTINCT ON (e.student_id, c.school_year_id)
         e.student_id,
         c.school_year_id,
         c.campus_id,
         c.grade_level_id AS first_grade_level_id
  FROM "enrollment" e
  JOIN "class" c ON c.id = e.class_id
  ORDER BY e.student_id, c.school_year_id, e.enrollment_date ASC, e.id ASC
),
aggregated AS (
  SELECT e.student_id,
         c.school_year_id,
         MIN(e.enrollment_date)                                                 AS enrollment_date,
         CASE WHEN bool_and(e.end_date IS NOT NULL) THEN MAX(e.end_date) END    AS exit_date,
         CASE WHEN bool_and(e.end_date IS NOT NULL) THEN 'COMPLETED' END        AS exit_reason
  FROM "enrollment" e
  JOIN "class" c ON c.id = e.class_id
  GROUP BY e.student_id, c.school_year_id
),
new_parents AS (
  INSERT INTO "school_year_enrollment" (
    id, student_id, campus_id, school_year_id, grade_level_id,
    enrollment_date, exit_date, exit_reason, note, created_at, updated_at
  )
  SELECT gen_random_uuid(),
         g.student_id,
         g.campus_id,
         g.school_year_id,
         g.first_grade_level_id,
         a.enrollment_date,
         a.exit_date,
         a.exit_reason,
         NULL,
         now(),
         now()
  FROM grouped g
  JOIN aggregated a
    ON a.student_id = g.student_id
   AND a.school_year_id = g.school_year_id
  RETURNING id, student_id, school_year_id
)
UPDATE "enrollment" e
SET "school_year_enrollment_id" = np.id
FROM new_parents np, "class" c
WHERE c.id = e.class_id
  AND e.student_id = np.student_id
  AND c.school_year_id = np.school_year_id;

-- ============================================
-- 5. Promote child FK to NOT NULL + add FK index
-- ============================================
ALTER TABLE "enrollment"
  ALTER COLUMN "school_year_enrollment_id" SET NOT NULL;

CREATE INDEX "enrollment_school_year_enrollment_id_idx"
  ON "enrollment" ("school_year_enrollment_id");

-- ============================================
-- 6. Partial unique index: one open parent per (student, school year)
--    (D6 / spec AC-9). Prisma cannot express this natively; raw SQL only.
-- ============================================
CREATE UNIQUE INDEX "idx_sye_one_open_per_year"
  ON "school_year_enrollment" ("student_id", "school_year_id")
  WHERE "exit_date" IS NULL;

-- ============================================
-- DOWN MIGRATION (manual rollback reference — Prisma has no native down support)
--
-- Forward-only after promotion. v1 commits to keeping the parent table; rolling
-- back here loses parent rows (the child FK + NOT NULL flip are reversible, but
-- the parent rows themselves are dropped with the table). Acceptable per NFR-1
-- mirror — rolling back means abandoning the SchoolYearEnrollment model entirely.
--
-- If a rollback is required, apply the following via psql against the target DB
-- in this exact order, then revert the schema.prisma changes and run
-- `npx prisma generate`:
--
--   -- Drop the child FK + supporting indexes + NOT NULL flip
--   DROP INDEX IF EXISTS "enrollment_school_year_enrollment_id_idx";
--   ALTER TABLE "enrollment"
--     DROP CONSTRAINT IF EXISTS "enrollment_school_year_enrollment_id_fkey";
--   ALTER TABLE "enrollment"
--     DROP COLUMN IF EXISTS "school_year_enrollment_id";
--
--   -- Drop the parent table indexes + table
--   DROP INDEX IF EXISTS "idx_sye_one_open_per_year";
--   DROP INDEX IF EXISTS "school_year_enrollment_campus_id_idx";
--   DROP INDEX IF EXISTS "school_year_enrollment_grade_level_id_idx";
--   DROP INDEX IF EXISTS "school_year_enrollment_school_year_id_idx";
--   DROP INDEX IF EXISTS "school_year_enrollment_student_id_idx";
--   DROP TABLE IF EXISTS "school_year_enrollment";
--
-- After applying the rollback, also remove from schema.prisma:
--   - the SchoolYearEnrollment model
--   - the schoolYearEnrollmentId field + relation on Enrollment
--   - the reverse relations on Student / Campus / SchoolYear / GradeLevel
-- ============================================
