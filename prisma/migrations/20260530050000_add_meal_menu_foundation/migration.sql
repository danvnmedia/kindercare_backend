-- ============================================================================
-- Migration: add_meal_menu_foundation
-- ============================================================================
-- Adds the normalized meal-menu persistence foundation for
-- @doc/specs/meal-menu-backend:
--   - parent `meal_menu` rows scoped by campus and optional grade level
--   - child `meal_menu_entry` rows for non-blank grid cells
--   - one campus-scoped `meal_menu_config` row for future menu defaults
--
-- Important Prisma/default conventions used in this repository:
--   - UUID primary keys have no DB default (`@default(uuid())` is Prisma/client-side)
--   - `created_at` uses DEFAULT CURRENT_TIMESTAMP (`@default(now())`)
--   - `updated_at` has no DB default (`@updatedAt` is Prisma/client-managed)
--
-- Whole-campus menus use `grade_level_id IS NULL`. PostgreSQL's normal unique
-- index semantics treat NULLs as distinct, so the active natural key is created
-- with PostgreSQL 15+ `NULLS NOT DISTINCT` to make `(campus, NULL, week)`
-- collide. The uniqueness is active-only so archived menus can coexist with a
-- replacement active menu and later return a restore conflict.
-- ============================================================================

-- ============================================================================
-- 1. Create parent weekly menu table
-- ============================================================================
CREATE TABLE "meal_menu" (
    "id"              UUID NOT NULL,
    "campus_id"       UUID NOT NULL,
    "grade_level_id"  UUID,
    "week_start_date" DATE NOT NULL,
    "title"           TEXT,
    "days"            INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "meal_slots"      TEXT[] NOT NULL DEFAULT ARRAY['Breakfast', 'Lunch', 'Afternoon']::TEXT[],
    "is_archived"     BOOLEAN NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meal_menu_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "meal_menu_campus_id_fkey"
        FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "meal_menu_grade_level_id_fkey"
        FOREIGN KEY ("grade_level_id") REFERENCES "grade_level"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "meal_menu_campus_id_idx" ON "meal_menu"("campus_id");
CREATE INDEX "meal_menu_grade_level_id_idx" ON "meal_menu"("grade_level_id");
CREATE INDEX "meal_menu_week_start_date_idx" ON "meal_menu"("week_start_date");
CREATE INDEX "meal_menu_is_archived_idx" ON "meal_menu"("is_archived");

CREATE INDEX "meal_menu_natural_key_lookup"
    ON "meal_menu" ("campus_id", "grade_level_id", "week_start_date");

-- NULLS NOT DISTINCT makes active whole-campus rows (`grade_level_id IS NULL`)
-- unique per campus/week while still allowing archived historical collisions.
CREATE UNIQUE INDEX "meal_menu_active_natural_key"
    ON "meal_menu" ("campus_id", "grade_level_id", "week_start_date")
    NULLS NOT DISTINCT
    WHERE "is_archived" = false;

-- ============================================================================
-- 2. Create normalized grid-entry table
-- ============================================================================
CREATE TABLE "meal_menu_entry" (
    "id"           UUID NOT NULL,
    "meal_menu_id" UUID NOT NULL,
    "day_of_week"  INTEGER NOT NULL,
    "slot"         TEXT NOT NULL,
    "description"  TEXT NOT NULL,
    "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meal_menu_entry_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "meal_menu_entry_meal_menu_id_fkey"
        FOREIGN KEY ("meal_menu_id") REFERENCES "meal_menu"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "meal_menu_entry_meal_menu_id_idx"
    ON "meal_menu_entry"("meal_menu_id");

CREATE UNIQUE INDEX "meal_menu_entry_cell_key"
    ON "meal_menu_entry"("meal_menu_id", "day_of_week", "slot");

-- ============================================================================
-- 3. Create campus-scoped meal-menu config table
-- ============================================================================
CREATE TABLE "meal_menu_config" (
    "id"                 UUID NOT NULL,
    "campus_id"          UUID NOT NULL,
    "operating_days"     INTEGER[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "default_meal_slots" TEXT[] NOT NULL DEFAULT ARRAY['Breakfast', 'Lunch', 'Afternoon']::TEXT[],
    "created_at"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meal_menu_config_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "meal_menu_config_campus_id_fkey"
        FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "meal_menu_config_campus_id_key"
    ON "meal_menu_config"("campus_id");

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- BEGIN;
--   DROP TABLE IF EXISTS "meal_menu_config";
--   DROP TABLE IF EXISTS "meal_menu_entry";
--   DROP TABLE IF EXISTS "meal_menu";
-- COMMIT;
