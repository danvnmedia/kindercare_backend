-- ============================================================================
-- Migration: add_completed_student_phase
-- ============================================================================
-- Recreates the student_with_phase view so SchoolYearEnrollment rows closed
-- with exit_reason='COMPLETED' project public phase='COMPLETED' instead of
-- falling through to WAITING. Preserves the current_class projection added in
-- 20260526234000_extend_student_with_phase_current_class.
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
    ) = 'COMPLETED' THEN 'COMPLETED'
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
--     END AS phase,
--     open_e.class_id AS current_class_id,
--     open_c.name     AS current_class_name
--   FROM "student" s
--   LEFT JOIN LATERAL (
--     SELECT e.class_id
--     FROM "enrollment" e
--     WHERE e.student_id = s.id AND e.end_date IS NULL
--     LIMIT 1
--   ) open_e ON TRUE
--   LEFT JOIN "class" open_c ON open_c.id = open_e.class_id;
-- COMMIT;
