-- ============================================================================
-- Migration: add_student_health_foundation
-- ============================================================================
-- Adds current-campus scoped Student Health V1 persistence for
-- @doc/specs/2026-07-01/student-profile-health-tab-backend:
--   - profile snapshot json arrays for allergies / conditions / restrictions
--   - checkup records with metric height/weight fields
--   - care/medication instructions for teacher-facing active reads
--   - health history events for timeline records
--
-- Repository conventions:
--   - UUID primary keys have no DB default (`@default(uuid())` is Prisma/client-side)
--   - `created_at` uses DEFAULT CURRENT_TIMESTAMP (`@default(now())`)
--   - `updated_at` has no DB default (`@updatedAt` is Prisma/client-managed)
--   - BMI/percentile fields are intentionally absent from V1
-- ============================================================================

CREATE TYPE "StudentHealthAllergySeverity" AS ENUM (
    'MILD',
    'MODERATE',
    'SEVERE',
    'UNKNOWN'
);

CREATE TYPE "StudentHealthConditionCategory" AS ENUM (
    'EYE',
    'ENT',
    'RESPIRATORY',
    'SKIN',
    'DIGESTIVE',
    'CARDIAC',
    'NEUROLOGICAL',
    'MOBILITY',
    'OTHER'
);

CREATE TYPE "StudentHealthConditionStatus" AS ENUM (
    'ACTIVE',
    'MONITORING',
    'RESOLVED',
    'UNKNOWN'
);

CREATE TYPE "StudentHealthRestrictionType" AS ENUM (
    'FOOD',
    'ACTIVITY',
    'MEDICATION',
    'ENVIRONMENT',
    'OTHER'
);

CREATE TYPE "StudentHealthCheckupType" AS ENUM (
    'GENERAL',
    'GROWTH',
    'VISION',
    'OTHER'
);

CREATE TYPE "StudentHealthInstructionType" AS ENUM (
    'MEDICATION',
    'CARE',
    'DIET',
    'ACTIVITY',
    'OTHER'
);

CREATE TYPE "StudentHealthEventType" AS ENUM (
    'ILLNESS',
    'INJURY',
    'SYMPTOM',
    'OBSERVATION',
    'OTHER'
);

CREATE TYPE "StudentHealthEventStatus" AS ENUM (
    'OPEN',
    'RESOLVED',
    'ARCHIVED'
);

CREATE TABLE "student_health_profile" (
    "id"                      UUID NOT NULL,
    "campus_id"               UUID NOT NULL,
    "student_id"              UUID NOT NULL,
    "allergies"               JSONB NOT NULL DEFAULT '[]',
    "conditions"              JSONB NOT NULL DEFAULT '[]',
    "restrictions"            JSONB NOT NULL DEFAULT '[]',
    "emergency_notes"         TEXT,
    "last_updated_by_user_id" UUID,
    "created_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_health_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_health_profile_student_id_key" UNIQUE ("student_id"),
    CONSTRAINT "student_health_profile_allergies_array_check"
        CHECK (jsonb_typeof("allergies") = 'array'),
    CONSTRAINT "student_health_profile_conditions_array_check"
        CHECK (jsonb_typeof("conditions") = 'array'),
    CONSTRAINT "student_health_profile_restrictions_array_check"
        CHECK (jsonb_typeof("restrictions") = 'array')
);

CREATE TABLE "student_health_checkup" (
    "id"                      UUID NOT NULL,
    "campus_id"               UUID NOT NULL,
    "student_id"              UUID NOT NULL,
    "checkup_type"            "StudentHealthCheckupType" NOT NULL DEFAULT 'GENERAL',
    "checked_at"              TIMESTAMPTZ(6) NOT NULL,
    "height_cm"               DECIMAL(5,2),
    "weight_kg"               DECIMAL(5,2),
    "notes"                   TEXT,
    "recorded_by_user_id"     UUID,
    "last_updated_by_user_id" UUID,
    "created_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_health_checkup_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_health_checkup_height_positive_check"
        CHECK ("height_cm" IS NULL OR "height_cm" > 0),
    CONSTRAINT "student_health_checkup_weight_positive_check"
        CHECK ("weight_kg" IS NULL OR "weight_kg" > 0),
    CONSTRAINT "student_health_checkup_meaningful_value_check"
        CHECK (
            "height_cm" IS NOT NULL
            OR "weight_kg" IS NOT NULL
            OR ("notes" IS NOT NULL AND length(btrim("notes")) > 0)
        )
);

CREATE TABLE "student_health_instruction" (
    "id"                      UUID NOT NULL,
    "campus_id"               UUID NOT NULL,
    "student_id"              UUID NOT NULL,
    "instruction_type"        "StudentHealthInstructionType" NOT NULL,
    "title"                   VARCHAR(200) NOT NULL,
    "instruction"             TEXT NOT NULL,
    "dosage"                  VARCHAR(200),
    "start_date"              DATE NOT NULL,
    "end_date"                DATE,
    "times_of_day"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "schedule_notes"          TEXT,
    "notes"                   TEXT,
    "is_active"               BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id"      UUID,
    "last_updated_by_user_id" UUID,
    "created_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_health_instruction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_health_instruction_title_non_blank_check"
        CHECK (length(btrim("title")) > 0),
    CONSTRAINT "student_health_instruction_instruction_non_blank_check"
        CHECK (length(btrim("instruction")) > 0),
    CONSTRAINT "student_health_instruction_end_date_check"
        CHECK ("end_date" IS NULL OR "end_date" >= "start_date")
);

CREATE TABLE "student_health_event" (
    "id"                      UUID NOT NULL,
    "campus_id"               UUID NOT NULL,
    "student_id"              UUID NOT NULL,
    "event_type"              "StudentHealthEventType" NOT NULL,
    "category"                "StudentHealthConditionCategory",
    "title"                   VARCHAR(200) NOT NULL,
    "description"             TEXT,
    "occurred_at"             TIMESTAMPTZ(6) NOT NULL,
    "status"                  "StudentHealthEventStatus" NOT NULL DEFAULT 'OPEN',
    "resolution_notes"        TEXT,
    "recorded_by_user_id"     UUID,
    "last_updated_by_user_id" UUID,
    "created_at"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_health_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_health_event_title_non_blank_check"
        CHECK (length(btrim("title")) > 0)
);

CREATE INDEX "student_health_profile_campus_id_idx"
    ON "student_health_profile"("campus_id");

CREATE INDEX "student_health_profile_last_updated_by_user_id_idx"
    ON "student_health_profile"("last_updated_by_user_id");

CREATE INDEX "student_health_checkup_campus_id_idx"
    ON "student_health_checkup"("campus_id");

CREATE INDEX "student_health_checkup_student_id_idx"
    ON "student_health_checkup"("student_id");

CREATE INDEX "student_health_checkup_lookup_idx"
    ON "student_health_checkup"("campus_id", "student_id", "checked_at" DESC);

CREATE INDEX "student_health_checkup_checkup_type_idx"
    ON "student_health_checkup"("checkup_type");

CREATE INDEX "student_health_checkup_recorded_by_user_id_idx"
    ON "student_health_checkup"("recorded_by_user_id");

CREATE INDEX "student_health_checkup_last_updated_by_user_id_idx"
    ON "student_health_checkup"("last_updated_by_user_id");

CREATE INDEX "student_health_instruction_campus_id_idx"
    ON "student_health_instruction"("campus_id");

CREATE INDEX "student_health_instruction_student_id_idx"
    ON "student_health_instruction"("student_id");

CREATE INDEX "student_health_instruction_active_idx"
    ON "student_health_instruction"("campus_id", "student_id", "is_active", "start_date", "end_date");

CREATE INDEX "student_health_instruction_instruction_type_idx"
    ON "student_health_instruction"("instruction_type");

CREATE INDEX "student_health_instruction_created_by_user_id_idx"
    ON "student_health_instruction"("created_by_user_id");

CREATE INDEX "student_health_instruction_last_updated_by_user_id_idx"
    ON "student_health_instruction"("last_updated_by_user_id");

CREATE INDEX "student_health_event_campus_id_idx"
    ON "student_health_event"("campus_id");

CREATE INDEX "student_health_event_student_id_idx"
    ON "student_health_event"("student_id");

CREATE INDEX "student_health_event_timeline_idx"
    ON "student_health_event"("campus_id", "student_id", "occurred_at" DESC);

CREATE INDEX "student_health_event_event_type_idx"
    ON "student_health_event"("event_type");

CREATE INDEX "student_health_event_category_idx"
    ON "student_health_event"("category");

CREATE INDEX "student_health_event_status_idx"
    ON "student_health_event"("status");

CREATE INDEX "student_health_event_recorded_by_user_id_idx"
    ON "student_health_event"("recorded_by_user_id");

CREATE INDEX "student_health_event_last_updated_by_user_id_idx"
    ON "student_health_event"("last_updated_by_user_id");

ALTER TABLE "student_health_profile"
    ADD CONSTRAINT "student_health_profile_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_health_profile"
    ADD CONSTRAINT "student_health_profile_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_health_profile"
    ADD CONSTRAINT "student_health_profile_last_updated_by_user_id_fkey"
    FOREIGN KEY ("last_updated_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_health_checkup"
    ADD CONSTRAINT "student_health_checkup_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_health_checkup"
    ADD CONSTRAINT "student_health_checkup_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_health_checkup"
    ADD CONSTRAINT "student_health_checkup_recorded_by_user_id_fkey"
    FOREIGN KEY ("recorded_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_health_checkup"
    ADD CONSTRAINT "student_health_checkup_last_updated_by_user_id_fkey"
    FOREIGN KEY ("last_updated_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_health_instruction"
    ADD CONSTRAINT "student_health_instruction_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_health_instruction"
    ADD CONSTRAINT "student_health_instruction_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_health_instruction"
    ADD CONSTRAINT "student_health_instruction_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_health_instruction"
    ADD CONSTRAINT "student_health_instruction_last_updated_by_user_id_fkey"
    FOREIGN KEY ("last_updated_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_health_event"
    ADD CONSTRAINT "student_health_event_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "student_health_event"
    ADD CONSTRAINT "student_health_event_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "student"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_health_event"
    ADD CONSTRAINT "student_health_event_recorded_by_user_id_fkey"
    FOREIGN KEY ("recorded_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_health_event"
    ADD CONSTRAINT "student_health_event_last_updated_by_user_id_fkey"
    FOREIGN KEY ("last_updated_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
