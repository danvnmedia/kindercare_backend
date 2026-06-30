-- ============================================================================
-- Migration: add_weekly_plan_foundation
-- ============================================================================
-- Adds class-specific weekly plans for @doc/specs/weekly-plan-daily-schedule:
--   - parent `weekly_plan` rows scoped by campus, class, and Monday week
--   - child `weekly_plan_block` rows storing timezone-free minutes from midnight
--   - child `weekly_plan_activity` rows preserving per-block activity order
--
-- Repository conventions:
--   - UUID primary keys have no DB default (`@default(uuid())` is Prisma/client-side)
--   - `created_at` uses DEFAULT CURRENT_TIMESTAMP (`@default(now())`)
--   - `updated_at` has no DB default (`@updatedAt` is Prisma/client-managed)
--
-- Active class/week uniqueness is enforced with a partial unique index so
-- archived plans can coexist with replacement active plans and later return a
-- restore conflict.
-- ============================================================================

CREATE TABLE "weekly_plan" (
    "id"              UUID NOT NULL,
    "campus_id"       UUID NOT NULL,
    "class_id"        UUID NOT NULL,
    "week_start_date" DATE NOT NULL,
    "theme"           VARCHAR(255),
    "is_archived"     BOOLEAN NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "weekly_plan_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "weekly_plan_campus_id_fkey"
        FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,

    CONSTRAINT "weekly_plan_class_id_fkey"
        FOREIGN KEY ("class_id") REFERENCES "class"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "weekly_plan_campus_id_idx"
    ON "weekly_plan"("campus_id");

CREATE INDEX "weekly_plan_class_id_idx"
    ON "weekly_plan"("class_id");

CREATE INDEX "weekly_plan_week_start_date_idx"
    ON "weekly_plan"("week_start_date");

CREATE INDEX "weekly_plan_is_archived_idx"
    ON "weekly_plan"("is_archived");

CREATE INDEX "weekly_plan_class_week_lookup"
    ON "weekly_plan" ("campus_id", "class_id", "week_start_date");

CREATE UNIQUE INDEX "weekly_plan_active_class_week_key"
    ON "weekly_plan" ("campus_id", "class_id", "week_start_date")
    WHERE "is_archived" = false;

CREATE TABLE "weekly_plan_block" (
    "id"             UUID NOT NULL,
    "weekly_plan_id" UUID NOT NULL,
    "day_of_week"    INTEGER NOT NULL,
    "start_minute"   INTEGER NOT NULL,
    "end_minute"     INTEGER NOT NULL,
    "order"          INTEGER NOT NULL DEFAULT 0,
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "weekly_plan_block_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "weekly_plan_block_weekly_plan_id_fkey"
        FOREIGN KEY ("weekly_plan_id") REFERENCES "weekly_plan"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "weekly_plan_block_day_of_week_check"
        CHECK ("day_of_week" BETWEEN 1 AND 7),

    CONSTRAINT "weekly_plan_block_minutes_check"
        CHECK (
            "start_minute" >= 0
            AND "start_minute" < 1440
            AND "end_minute" > 0
            AND "end_minute" <= 1440
            AND "start_minute" < "end_minute"
        )
);

CREATE INDEX "weekly_plan_block_weekly_plan_id_idx"
    ON "weekly_plan_block"("weekly_plan_id");

CREATE INDEX "weekly_plan_block_day_of_week_start_minute_idx"
    ON "weekly_plan_block"("day_of_week", "start_minute");

CREATE TABLE "weekly_plan_activity" (
    "id"                   UUID NOT NULL,
    "weekly_plan_block_id"  UUID NOT NULL,
    "order"                INTEGER NOT NULL,
    "text"                 VARCHAR(500) NOT NULL,
    "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "weekly_plan_activity_pkey" PRIMARY KEY ("id"),

    CONSTRAINT "weekly_plan_activity_weekly_plan_block_id_fkey"
        FOREIGN KEY ("weekly_plan_block_id") REFERENCES "weekly_plan_block"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "weekly_plan_activity_text_non_blank_check"
        CHECK (length(btrim("text")) > 0)
);

CREATE UNIQUE INDEX "weekly_plan_activity_order_key"
    ON "weekly_plan_activity"("weekly_plan_block_id", "order");

CREATE INDEX "weekly_plan_activity_weekly_plan_block_id_idx"
    ON "weekly_plan_activity"("weekly_plan_block_id");

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- BEGIN;
--   DROP TABLE IF EXISTS "weekly_plan_activity";
--   DROP TABLE IF EXISTS "weekly_plan_block";
--   DROP TABLE IF EXISTS "weekly_plan";
-- COMMIT;
