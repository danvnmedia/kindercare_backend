-- ============================================================================
-- Migration: add_meal_menu_class_targeting
-- ============================================================================
-- Evolves meal_menu from implicit grade_level_id targeting to explicit target
-- identity for @doc/specs/meal-menu-class-targeting:
--   - target_type = campus | grade | class
--   - grade_level_id is only populated for grade targets
--   - class_id is only populated for class targets
--
-- Existing rows are backfilled without changing ids, entries, archive state,
-- dates, titles, or timestamps:
--   - grade_level_id IS NULL     -> target_type = 'campus'
--   - grade_level_id IS NOT NULL -> target_type = 'grade'
--
-- Active exact-target uniqueness is enforced with partial unique indexes so
-- archived rows remain historical and do not block new active menus.
-- ============================================================================

ALTER TABLE "meal_menu"
  ADD COLUMN "target_type" TEXT,
  ADD COLUMN "class_id" UUID;

UPDATE "meal_menu"
SET "target_type" = CASE
  WHEN "grade_level_id" IS NULL THEN 'campus'
  ELSE 'grade'
END
WHERE "target_type" IS NULL;

ALTER TABLE "meal_menu"
  ALTER COLUMN "target_type" SET NOT NULL;

ALTER TABLE "meal_menu"
  ADD CONSTRAINT "meal_menu_class_id_fkey"
    FOREIGN KEY ("class_id") REFERENCES "class"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "meal_menu"
  ADD CONSTRAINT "meal_menu_target_identity_check"
    CHECK (
      ("target_type" = 'campus' AND "grade_level_id" IS NULL AND "class_id" IS NULL)
      OR ("target_type" = 'grade' AND "grade_level_id" IS NOT NULL AND "class_id" IS NULL)
      OR ("target_type" = 'class' AND "grade_level_id" IS NULL AND "class_id" IS NOT NULL)
    );

DROP INDEX IF EXISTS "meal_menu_active_natural_key";
DROP INDEX IF EXISTS "meal_menu_natural_key_lookup";

CREATE INDEX "meal_menu_target_lookup"
  ON "meal_menu" ("campus_id", "target_type", "grade_level_id", "class_id", "week_start_date");

CREATE INDEX "meal_menu_target_type_idx"
  ON "meal_menu"("target_type");

CREATE INDEX "meal_menu_class_id_idx"
  ON "meal_menu"("class_id");

CREATE UNIQUE INDEX "meal_menu_active_campus_target_key"
  ON "meal_menu" ("campus_id", "week_start_date")
  WHERE "is_archived" = false AND "target_type" = 'campus';

CREATE UNIQUE INDEX "meal_menu_active_grade_target_key"
  ON "meal_menu" ("campus_id", "grade_level_id", "week_start_date")
  WHERE "is_archived" = false AND "target_type" = 'grade';

CREATE UNIQUE INDEX "meal_menu_active_class_target_key"
  ON "meal_menu" ("campus_id", "class_id", "week_start_date")
  WHERE "is_archived" = false AND "target_type" = 'class';
