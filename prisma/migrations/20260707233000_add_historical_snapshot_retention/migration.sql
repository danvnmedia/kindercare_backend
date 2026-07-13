-- ============================================================================
-- Migration: add_historical_snapshot_retention
-- ============================================================================
-- Adds phase-one point-in-time snapshot fields for enrollment history plus
-- append-only correction and retention policy companions.
-- ============================================================================

BEGIN;

ALTER TABLE "enrollment"
  ADD COLUMN "snapshot_student_full_name" TEXT,
  ADD COLUMN "snapshot_student_code" TEXT,
  ADD COLUMN "snapshot_student_nickname" TEXT,
  ADD COLUMN "snapshot_class_name" TEXT,
  ADD COLUMN "snapshot_grade_level_name" TEXT,
  ADD COLUMN "snapshot_grade_level_order" INTEGER,
  ADD COLUMN "snapshot_school_year_name" TEXT,
  ADD COLUMN "snapshot_school_year_start_date" DATE,
  ADD COLUMN "snapshot_school_year_end_date" DATE,
  ADD COLUMN "snapshot_captured_at" TIMESTAMPTZ(6),
  ADD COLUMN "historical_finalized_at" TIMESTAMPTZ(6),
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN "redacted_at" TIMESTAMPTZ(6),
  ADD COLUMN "retention_expires_at" DATE,
  ADD COLUMN "retention_policy_source" TEXT,
  ADD COLUMN "legal_hold" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "school_year_enrollment"
  ADD COLUMN "snapshot_student_full_name" TEXT,
  ADD COLUMN "snapshot_student_code" TEXT,
  ADD COLUMN "snapshot_student_nickname" TEXT,
  ADD COLUMN "snapshot_grade_level_name" TEXT,
  ADD COLUMN "snapshot_grade_level_order" INTEGER,
  ADD COLUMN "snapshot_school_year_name" TEXT,
  ADD COLUMN "snapshot_school_year_start_date" DATE,
  ADD COLUMN "snapshot_school_year_end_date" DATE,
  ADD COLUMN "snapshot_captured_at" TIMESTAMPTZ(6),
  ADD COLUMN "historical_finalized_at" TIMESTAMPTZ(6),
  ADD COLUMN "archived_at" TIMESTAMPTZ(6),
  ADD COLUMN "redacted_at" TIMESTAMPTZ(6),
  ADD COLUMN "retention_expires_at" DATE,
  ADD COLUMN "retention_policy_source" TEXT,
  ADD COLUMN "legal_hold" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "HistoricalRecordType" AS ENUM (
  'ENROLLMENT',
  'SCHOOL_YEAR_ENROLLMENT'
);

CREATE TABLE "historical_record_correction_event" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campus_id" UUID NOT NULL,
  "record_type" "HistoricalRecordType" NOT NULL,
  "record_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "before_value" JSONB NOT NULL,
  "after_value" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historical_record_correction_event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historical_correction_record_idx"
  ON "historical_record_correction_event"("record_type", "record_id", "created_at" DESC);

CREATE INDEX "historical_correction_campus_idx"
  ON "historical_record_correction_event"("campus_id", "created_at" DESC);

CREATE TABLE "historical_retention_policy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campus_id" UUID,
  "environment" VARCHAR(80),
  "policy_source" TEXT NOT NULL,
  "retention_days" INTEGER NOT NULL,
  "deletion_allowed" BOOLEAN NOT NULL DEFAULT false,
  "redaction_allowed" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "historical_retention_policy_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "historical_retention_policy_lookup_idx"
  ON "historical_retention_policy"("campus_id", "environment", "is_active");

COMMIT;

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- BEGIN;
--   DROP TABLE IF EXISTS "historical_retention_policy";
--   DROP TABLE IF EXISTS "historical_record_correction_event";
--   DROP TYPE IF EXISTS "HistoricalRecordType";
--   ALTER TABLE "school_year_enrollment"
--     DROP COLUMN IF EXISTS "legal_hold",
--     DROP COLUMN IF EXISTS "retention_policy_source",
--     DROP COLUMN IF EXISTS "retention_expires_at",
--     DROP COLUMN IF EXISTS "redacted_at",
--     DROP COLUMN IF EXISTS "archived_at",
--     DROP COLUMN IF EXISTS "historical_finalized_at",
--     DROP COLUMN IF EXISTS "snapshot_captured_at",
--     DROP COLUMN IF EXISTS "snapshot_school_year_end_date",
--     DROP COLUMN IF EXISTS "snapshot_school_year_start_date",
--     DROP COLUMN IF EXISTS "snapshot_school_year_name",
--     DROP COLUMN IF EXISTS "snapshot_grade_level_order",
--     DROP COLUMN IF EXISTS "snapshot_grade_level_name",
--     DROP COLUMN IF EXISTS "snapshot_student_nickname",
--     DROP COLUMN IF EXISTS "snapshot_student_code",
--     DROP COLUMN IF EXISTS "snapshot_student_full_name";
--   ALTER TABLE "enrollment"
--     DROP COLUMN IF EXISTS "legal_hold",
--     DROP COLUMN IF EXISTS "retention_policy_source",
--     DROP COLUMN IF EXISTS "retention_expires_at",
--     DROP COLUMN IF EXISTS "redacted_at",
--     DROP COLUMN IF EXISTS "archived_at",
--     DROP COLUMN IF EXISTS "historical_finalized_at",
--     DROP COLUMN IF EXISTS "snapshot_captured_at",
--     DROP COLUMN IF EXISTS "snapshot_school_year_end_date",
--     DROP COLUMN IF EXISTS "snapshot_school_year_start_date",
--     DROP COLUMN IF EXISTS "snapshot_school_year_name",
--     DROP COLUMN IF EXISTS "snapshot_grade_level_order",
--     DROP COLUMN IF EXISTS "snapshot_grade_level_name",
--     DROP COLUMN IF EXISTS "snapshot_class_name",
--     DROP COLUMN IF EXISTS "snapshot_student_nickname",
--     DROP COLUMN IF EXISTS "snapshot_student_code",
--     DROP COLUMN IF EXISTS "snapshot_student_full_name";
-- COMMIT;
