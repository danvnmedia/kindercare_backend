-- ============================================================================
-- Migration: extend_student_with_phase_current_class
-- ============================================================================
-- Adds two derived columns to the `student_with_phase` view that project the
-- student's *currently open* enrollment's class (id + name). Lights up
-- `GET /students` + `GET /students/:id` from one mapper change because all
-- student read paths already go through this view.
--
-- The phase CASE expression is copied byte-for-byte from
-- `20260515130000_drop_student_status_add_phase_view/migration.sql` (FR-6 /
-- spec AC-11 — preserve existing phase semantics). This migration is purely
-- additive — only two new nullable columns appended to the SELECT list.
--
-- LEFT JOIN LATERAL on `enrollment` (WHERE end_date IS NULL) is deterministic
-- thanks to the partial unique index `idx_enrollment_one_active_per_student`
-- introduced in migration 20260505160000:
--   CREATE UNIQUE INDEX idx_enrollment_one_active_per_student
--     ON enrollment (student_id) WHERE end_date IS NULL;
-- The explicit `LIMIT 1` is belt-and-braces — it makes the intent obvious at
-- the query site even though the index already enforces uniqueness.
--
-- See @doc/specs/student-current-class-surfacing (D1, view sketch).
-- ============================================================================

BEGIN;

DROP VIEW IF EXISTS "student_with_phase";

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
  END AS phase,
  open_e.class_id AS current_class_id,
  open_c.name     AS current_class_name
FROM "student" s
LEFT JOIN LATERAL (
  SELECT e.class_id
  FROM "enrollment" e
  WHERE e.student_id = s.id AND e.end_date IS NULL
  LIMIT 1
) open_e ON TRUE
LEFT JOIN "class" open_c ON open_c.id = open_e.class_id;

COMMIT;

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- Re-creates the prior view shape (phase only, no current_class_* columns).
-- Run this if a forward deploy needs to be undone.
-- ============================================================================
-- BEGIN;
--   DROP VIEW IF EXISTS "student_with_phase";
--   CREATE VIEW "student_with_phase" AS
--   SELECT
--     s.*,
--     CASE
--       WHEN EXISTS (
--         SELECT 1 FROM "enrollment" e
--         WHERE e.student_id = s.id AND e.end_date IS NULL
--       ) THEN 'ACTIVE'
--       WHEN EXISTS (
--         SELECT 1 FROM "school_year_enrollment" sye
--         JOIN "school_year" sy ON sy.id = sye.school_year_id
--         WHERE sye.student_id = s.id
--           AND sye.exit_date IS NULL
--           AND sy.start_date > NOW()
--       ) THEN 'DEFERRED'
--       WHEN (
--         SELECT sye.exit_reason
--         FROM "school_year_enrollment" sye
--         WHERE sye.student_id = s.id AND sye.exit_date IS NOT NULL
--         ORDER BY sye.exit_date DESC
--         LIMIT 1
--       ) = 'GRADUATED' THEN 'GRADUATED'
--       WHEN (
--         SELECT sye.exit_reason
--         FROM "school_year_enrollment" sye
--         WHERE sye.student_id = s.id AND sye.exit_date IS NOT NULL
--         ORDER BY sye.exit_date DESC
--         LIMIT 1
--       ) = 'WITHDRAWN' THEN 'WITHDRAWN'
--       ELSE 'WAITING'
--     END AS phase
--   FROM "student" s;
-- COMMIT;
