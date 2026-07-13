-- ============================================================================
-- Migration: add_enrollment_cancellation_status
-- Spec: @doc/specs/2026-07-11/future-enrollment-status-and-cancellation-backend
-- ============================================================================
-- Adds nullable cancellation facts without changing existing row state,
-- replaces structural-open uniqueness with cancellation-aware constraints,
-- and enforces non-overlapping inclusive class-enrollment periods.
-- ============================================================================

-- Run diagnostics before opening the migration transaction. PostgreSQL reports
-- this exception directly to Prisma instead of masking it with the generic
-- "transaction is aborted" error from later statements in an aborted batch.
-- All pre-migration rows are necessarily uncancelled because cancellation
-- columns do not exist yet.
DO $$
DECLARE
  invalid_report TEXT;
  overlap_report TEXT;
BEGIN
  SELECT string_agg(
    format(
      'student=%s enrollment=%s class=%s start=%s end=%s',
      student_id,
      id,
      class_id,
      enrollment_date,
      end_date
    ),
    E'\n'
  )
  INTO invalid_report
  FROM (
    SELECT id, student_id, class_id, enrollment_date, end_date
    FROM "enrollment"
    WHERE end_date IS NOT NULL
      AND end_date < enrollment_date
    ORDER BY student_id, enrollment_date, id
    LIMIT 50
  ) AS invalid_rows;

  IF invalid_report IS NOT NULL THEN
    RAISE EXCEPTION E'ENROLLMENT_INTERVAL_INVALID: end_date precedes enrollment_date. Migration aborted; reconcile these rows before retrying.\nstudent | enrollment | class | start | end\n%', invalid_report;
  END IF;

  SELECT string_agg(
    format(
      'student=%s left=%s class=%s [%s,%s] right=%s class=%s [%s,%s]',
      left_student_id,
      left_id,
      left_class_id,
      left_start,
      coalesce(left_end::text, 'infinity'),
      right_id,
      right_class_id,
      right_start,
      coalesce(right_end::text, 'infinity')
    ),
    E'\n'
  )
  INTO overlap_report
  FROM (
    SELECT
      left_row.student_id AS left_student_id,
      left_row.id AS left_id,
      left_row.class_id AS left_class_id,
      left_row.enrollment_date AS left_start,
      left_row.end_date AS left_end,
      right_row.id AS right_id,
      right_row.class_id AS right_class_id,
      right_row.enrollment_date AS right_start,
      right_row.end_date AS right_end
    FROM "enrollment" left_row
    JOIN "enrollment" right_row
      ON right_row.student_id = left_row.student_id
     AND right_row.id > left_row.id
     AND daterange(
       left_row.enrollment_date,
       left_row.end_date,
       '[]'
     ) && daterange(
       right_row.enrollment_date,
       right_row.end_date,
       '[]'
     )
    ORDER BY left_row.student_id, left_row.enrollment_date, left_row.id
    LIMIT 50
  ) AS overlap_rows;

  IF overlap_report IS NOT NULL THEN
    RAISE EXCEPTION E'ENROLLMENT_PERIOD_OVERLAP: existing uncancelled inclusive enrollment intervals overlap. Migration aborted; reconcile these rows before retrying.\n%', overlap_report;
  END IF;
END $$;

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "enrollment"
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancellation_reason" TEXT,
  ADD COLUMN "cancellation_note" TEXT,
  ADD COLUMN "cancelled_by_user_id" UUID,
  ADD COLUMN "cancelled_by_full_name" TEXT;

ALTER TABLE "school_year_enrollment"
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancellation_reason" TEXT,
  ADD COLUMN "cancellation_note" TEXT,
  ADD COLUMN "cancelled_by_user_id" UUID,
  ADD COLUMN "cancelled_by_full_name" TEXT;

-- Existing rows remain uncancelled because every new column is nullable and no
-- data update/backfill is performed.
ALTER TABLE "enrollment"
  ADD CONSTRAINT "enrollment_cancellation_facts_check" CHECK (
    (
      cancelled_at IS NULL
      AND cancellation_reason IS NULL
      AND cancellation_note IS NULL
      AND cancelled_by_user_id IS NULL
      AND cancelled_by_full_name IS NULL
    )
    OR
    (
      cancelled_at IS NOT NULL
      AND cancellation_reason IS NOT NULL
      AND cancellation_reason IN (
        'FAMILY_REQUEST',
        'CHANGED_SCHOOL',
        'DUPLICATE_REGISTRATION',
        'DATA_ENTRY_ERROR',
        'OTHER'
      )
      AND cancelled_by_user_id IS NOT NULL
    )
  ),
  ADD CONSTRAINT "enrollment_cancellation_note_length_check" CHECK (
    cancellation_note IS NULL OR char_length(cancellation_note) <= 500
  );

ALTER TABLE "school_year_enrollment"
  ADD CONSTRAINT "school_year_enrollment_cancellation_facts_check" CHECK (
    (
      cancelled_at IS NULL
      AND cancellation_reason IS NULL
      AND cancellation_note IS NULL
      AND cancelled_by_user_id IS NULL
      AND cancelled_by_full_name IS NULL
    )
    OR
    (
      cancelled_at IS NOT NULL
      AND cancellation_reason IS NOT NULL
      AND cancellation_reason IN (
        'FAMILY_REQUEST',
        'CHANGED_SCHOOL',
        'DUPLICATE_REGISTRATION',
        'DATA_ENTRY_ERROR',
        'OTHER'
      )
      AND cancelled_by_user_id IS NOT NULL
    )
  ),
  ADD CONSTRAINT "school_year_enrollment_cancellation_note_length_check" CHECK (
    cancellation_note IS NULL OR char_length(cancellation_note) <= 500
  );

-- Hard-fail with actionable data before replacing the legacy uniqueness rule.
DO $$
DECLARE
  invalid_report TEXT;
  overlap_report TEXT;
BEGIN
  SELECT string_agg(
    format(
      'student=%s enrollment=%s class=%s start=%s end=%s',
      student_id,
      id,
      class_id,
      enrollment_date,
      end_date
    ),
    E'\n'
  )
  INTO invalid_report
  FROM (
    SELECT id, student_id, class_id, enrollment_date, end_date
    FROM "enrollment"
    WHERE cancelled_at IS NULL
      AND end_date IS NOT NULL
      AND end_date < enrollment_date
    ORDER BY student_id, enrollment_date, id
    LIMIT 50
  ) AS invalid_rows;

  IF invalid_report IS NOT NULL THEN
    RAISE EXCEPTION E'ENROLLMENT_INTERVAL_INVALID: end_date precedes enrollment_date. Migration aborted; reconcile these rows before retrying.\nstudent | enrollment | class | start | end\n%', invalid_report;
  END IF;

  SELECT string_agg(
    format(
      'student=%s left=%s class=%s [%s,%s] right=%s class=%s [%s,%s]',
      left_student_id,
      left_id,
      left_class_id,
      left_start,
      coalesce(left_end::text, 'infinity'),
      right_id,
      right_class_id,
      right_start,
      coalesce(right_end::text, 'infinity')
    ),
    E'\n'
  )
  INTO overlap_report
  FROM (
    SELECT
      left_row.student_id AS left_student_id,
      left_row.id AS left_id,
      left_row.class_id AS left_class_id,
      left_row.enrollment_date AS left_start,
      left_row.end_date AS left_end,
      right_row.id AS right_id,
      right_row.class_id AS right_class_id,
      right_row.enrollment_date AS right_start,
      right_row.end_date AS right_end
    FROM "enrollment" left_row
    JOIN "enrollment" right_row
      ON right_row.student_id = left_row.student_id
     AND right_row.id > left_row.id
     AND right_row.cancelled_at IS NULL
     AND daterange(
       left_row.enrollment_date,
       left_row.end_date,
       '[]'
     ) && daterange(
       right_row.enrollment_date,
       right_row.end_date,
       '[]'
     )
    WHERE left_row.cancelled_at IS NULL
    ORDER BY left_row.student_id, left_row.enrollment_date, left_row.id
    LIMIT 50
  ) AS overlap_rows;

  IF overlap_report IS NOT NULL THEN
    RAISE EXCEPTION E'ENROLLMENT_PERIOD_OVERLAP: existing uncancelled inclusive enrollment intervals overlap. Migration aborted; reconcile these rows before retrying.\n%', overlap_report;
  END IF;
END $$;

DROP INDEX IF EXISTS "idx_enrollment_one_active_per_student";
ALTER TABLE "enrollment"
  DROP CONSTRAINT IF EXISTS "enrollment_student_id_class_id_enrollment_date_key";

CREATE UNIQUE INDEX "idx_enrollment_unique_uncancelled_start"
  ON "enrollment" (student_id, class_id, enrollment_date)
  WHERE cancelled_at IS NULL;

ALTER TABLE "enrollment"
  ADD CONSTRAINT "enrollment_no_uncancelled_period_overlap"
  EXCLUDE USING gist (
    student_id WITH =,
    daterange(enrollment_date, end_date, '[]') WITH &&
  )
  WHERE (cancelled_at IS NULL);

DROP INDEX IF EXISTS "idx_sye_one_open_per_year";
CREATE UNIQUE INDEX "idx_sye_one_open_per_year"
  ON "school_year_enrollment" (student_id, school_year_id)
  WHERE exit_date IS NULL AND cancelled_at IS NULL;

CREATE INDEX "enrollment_class_effective_period_idx"
  ON "enrollment" (class_id, enrollment_date, end_date)
  WHERE cancelled_at IS NULL;

CREATE INDEX "school_year_enrollment_effective_period_idx"
  ON "school_year_enrollment" (school_year_id, enrollment_date, exit_date)
  WHERE cancelled_at IS NULL;

-- Rebuild the read-only student projection with the same UTC, inclusive-date,
-- and cancellation semantics used by the application domain.
DROP VIEW IF EXISTS "student_with_phase";

CREATE VIEW "student_with_phase" AS
WITH utc_clock AS (
  SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS today
)
SELECT
  student_row.*,
  CASE
    WHEN current_enrollment.class_id IS NOT NULL THEN 'ACTIVE'
    WHEN EXISTS (
      SELECT 1
      FROM "school_year_enrollment" parent
      CROSS JOIN utc_clock
      WHERE parent.student_id = student_row.id
        AND parent.cancelled_at IS NULL
        AND parent.enrollment_date > utc_clock.today
    ) THEN 'DEFERRED'
    WHEN latest_closed_parent.exit_reason = 'COMPLETED' THEN 'COMPLETED'
    WHEN latest_closed_parent.exit_reason = 'GRADUATED' THEN 'GRADUATED'
    WHEN latest_closed_parent.exit_reason = 'WITHDRAWN' THEN 'WITHDRAWN'
    ELSE 'WAITING'
  END AS phase,
  current_enrollment.class_id AS current_class_id,
  current_class.name AS current_class_name
FROM "student" student_row
LEFT JOIN LATERAL (
  SELECT enrollment.class_id
  FROM "enrollment" enrollment
  CROSS JOIN utc_clock
  WHERE enrollment.student_id = student_row.id
    AND enrollment.cancelled_at IS NULL
    AND enrollment.enrollment_date <= utc_clock.today
    AND (
      enrollment.end_date IS NULL
      OR enrollment.end_date >= utc_clock.today
    )
  ORDER BY enrollment.enrollment_date DESC, enrollment.id DESC
  LIMIT 1
) current_enrollment ON TRUE
LEFT JOIN "class" current_class
  ON current_class.id = current_enrollment.class_id
LEFT JOIN LATERAL (
  SELECT parent.exit_reason
  FROM "school_year_enrollment" parent
  CROSS JOIN utc_clock
  WHERE parent.student_id = student_row.id
    AND parent.cancelled_at IS NULL
    AND parent.exit_date < utc_clock.today
  ORDER BY parent.exit_date DESC, parent.id DESC
  LIMIT 1
) latest_closed_parent ON TRUE;

COMMIT;

-- Manual rollback reference:
-- BEGIN;
--   DROP VIEW IF EXISTS "student_with_phase";
--   DROP INDEX IF EXISTS "school_year_enrollment_effective_period_idx";
--   DROP INDEX IF EXISTS "enrollment_class_effective_period_idx";
--   DROP INDEX IF EXISTS "idx_sye_one_open_per_year";
--   CREATE UNIQUE INDEX "idx_sye_one_open_per_year"
--     ON "school_year_enrollment" (student_id, school_year_id)
--     WHERE exit_date IS NULL;
--   ALTER TABLE "enrollment"
--     DROP CONSTRAINT IF EXISTS "enrollment_no_uncancelled_period_overlap";
--   DROP INDEX IF EXISTS "idx_enrollment_unique_uncancelled_start";
--   ALTER TABLE "enrollment"
--     ADD CONSTRAINT "enrollment_student_id_class_id_enrollment_date_key"
--     UNIQUE (student_id, class_id, enrollment_date);
--   CREATE UNIQUE INDEX "idx_enrollment_one_active_per_student"
--     ON "enrollment" (student_id) WHERE end_date IS NULL;
--   ALTER TABLE "school_year_enrollment"
--     DROP CONSTRAINT IF EXISTS "school_year_enrollment_cancellation_note_length_check",
--     DROP CONSTRAINT IF EXISTS "school_year_enrollment_cancellation_facts_check",
--     DROP COLUMN IF EXISTS "cancelled_by_full_name",
--     DROP COLUMN IF EXISTS "cancelled_by_user_id",
--     DROP COLUMN IF EXISTS "cancellation_note",
--     DROP COLUMN IF EXISTS "cancellation_reason",
--     DROP COLUMN IF EXISTS "cancelled_at";
--   ALTER TABLE "enrollment"
--     DROP CONSTRAINT IF EXISTS "enrollment_cancellation_note_length_check",
--     DROP CONSTRAINT IF EXISTS "enrollment_cancellation_facts_check",
--     DROP COLUMN IF EXISTS "cancelled_by_full_name",
--     DROP COLUMN IF EXISTS "cancelled_by_user_id",
--     DROP COLUMN IF EXISTS "cancellation_note",
--     DROP COLUMN IF EXISTS "cancellation_reason",
--     DROP COLUMN IF EXISTS "cancelled_at";
-- COMMIT;
