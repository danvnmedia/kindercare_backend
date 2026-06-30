-- Change Weekly Plan activities from a single text field to title plus optional description.
-- Existing text values become title and descriptions start unset.

ALTER TABLE "weekly_plan_activity"
    RENAME COLUMN "text" TO "title";

ALTER TABLE "weekly_plan_activity"
    RENAME CONSTRAINT "weekly_plan_activity_text_non_blank_check"
    TO "weekly_plan_activity_title_non_blank_check";

ALTER TABLE "weekly_plan_activity"
    ADD COLUMN "description" VARCHAR(2000);

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- BEGIN;
--   ALTER TABLE "weekly_plan_activity" DROP COLUMN IF EXISTS "description";
--   ALTER TABLE "weekly_plan_activity"
--       RENAME CONSTRAINT "weekly_plan_activity_title_non_blank_check"
--       TO "weekly_plan_activity_text_non_blank_check";
--   ALTER TABLE "weekly_plan_activity" RENAME COLUMN "title" TO "text";
-- COMMIT;
