-- ============================================================================
-- Migration: add_medication_requests_administration
-- ============================================================================
-- Adds dedicated Medication V1 persistence for
-- @doc/specs/2026-07-01/medication-requests-and-administration-backend:
--   - parent-submitted medication requests
--   - medication item/order rows with daily HH:mm schedule arrays
--   - materialized administration occurrences
--   - append-only administration logs for record/correction history
--
-- Repository conventions:
--   - UUID primary keys have no DB default (`@default(uuid())` is Prisma/client-side)
--   - `created_at` uses DEFAULT CURRENT_TIMESTAMP (`@default(now())`)
--   - `updated_at` has no DB default (`@updatedAt` is Prisma/client-managed)
-- ============================================================================

CREATE TYPE "MedicationRequestStatus" AS ENUM (
    'SUBMITTED',
    'NEEDS_MORE_INFO',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'COMPLETED',
    'EXPIRED'
);

CREATE TYPE "MedicationAdministrationOutcome" AS ENUM (
    'GIVEN',
    'SKIPPED',
    'REFUSED',
    'ABSENT'
);

CREATE TABLE "medication_request" (
    "id"                    UUID NOT NULL,
    "campus_id"             UUID NOT NULL,
    "student_id"            UUID NOT NULL,
    "requester_guardian_id" UUID NOT NULL,
    "requester_user_id"     UUID,
    "status"                "MedicationRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "start_date"            DATE NOT NULL,
    "end_date"              DATE NOT NULL,
    "reason"                TEXT,
    "parent_notes"          TEXT,
    "reviewed_by_user_id"   UUID,
    "reviewed_at"           TIMESTAMPTZ(6),
    "review_note"           TEXT,
    "cancelled_at"          TIMESTAMPTZ(6),
    "cancel_reason"         TEXT,
    "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medication_request_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "medication_request_date_range_check"
        CHECK ("end_date" >= "start_date"),
    CONSTRAINT "medication_request_reason_non_blank_check"
        CHECK ("reason" IS NULL OR length(btrim("reason")) > 0),
    CONSTRAINT "medication_request_parent_notes_non_blank_check"
        CHECK ("parent_notes" IS NULL OR length(btrim("parent_notes")) > 0),
    CONSTRAINT "medication_request_review_note_non_blank_check"
        CHECK ("review_note" IS NULL OR length(btrim("review_note")) > 0),
    CONSTRAINT "medication_request_cancel_reason_non_blank_check"
        CHECK ("cancel_reason" IS NULL OR length(btrim("cancel_reason")) > 0)
);

CREATE TABLE "medication_request_item" (
    "id"              UUID NOT NULL,
    "request_id"      UUID NOT NULL,
    "medication_name" VARCHAR(200) NOT NULL,
    "dosage"          VARCHAR(200),
    "instructions"    TEXT NOT NULL,
    "times_of_day"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "schedule_notes"  TEXT,
    "notes"           TEXT,
    "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medication_request_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "medication_request_item_name_non_blank_check"
        CHECK (length(btrim("medication_name")) > 0),
    CONSTRAINT "medication_request_item_dosage_non_blank_check"
        CHECK ("dosage" IS NULL OR length(btrim("dosage")) > 0),
    CONSTRAINT "medication_request_item_instructions_non_blank_check"
        CHECK (length(btrim("instructions")) > 0),
    CONSTRAINT "medication_request_item_times_not_empty_check"
        CHECK (coalesce(array_length("times_of_day", 1), 0) > 0),
    CONSTRAINT "medication_request_item_schedule_notes_non_blank_check"
        CHECK ("schedule_notes" IS NULL OR length(btrim("schedule_notes")) > 0),
    CONSTRAINT "medication_request_item_notes_non_blank_check"
        CHECK ("notes" IS NULL OR length(btrim("notes")) > 0)
);

CREATE TABLE "medication_administration_occurrence" (
    "id"                         UUID NOT NULL,
    "request_id"                 UUID NOT NULL,
    "medication_item_id"         UUID NOT NULL,
    "campus_id"                  UUID NOT NULL,
    "student_id"                 UUID NOT NULL,
    "due_date"                   DATE NOT NULL,
    "due_minute"                 INTEGER NOT NULL,
    "latest_outcome"             "MedicationAdministrationOutcome",
    "latest_log_id"              UUID,
    "latest_recorded_at"         TIMESTAMPTZ(6),
    "latest_recorded_by_user_id" UUID,
    "latest_note"                TEXT,
    "created_at"                 TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                 TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medication_administration_occurrence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "med_admin_occurrence_due_minute_check"
        CHECK ("due_minute" >= 0 AND "due_minute" < 1440),
    CONSTRAINT "med_admin_occurrence_latest_note_non_blank_check"
        CHECK ("latest_note" IS NULL OR length(btrim("latest_note")) > 0)
);

CREATE TABLE "medication_administration_log" (
    "id"                   UUID NOT NULL,
    "occurrence_id"        UUID NOT NULL,
    "outcome"              "MedicationAdministrationOutcome" NOT NULL,
    "recorded_by_user_id"  UUID NOT NULL,
    "recorded_at"          TIMESTAMPTZ(6) NOT NULL,
    "actual_minute"        INTEGER,
    "note"                 TEXT,
    "correction_of_log_id" UUID,
    "created_at"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medication_administration_log_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "med_admin_log_actual_minute_check"
        CHECK ("actual_minute" IS NULL OR ("actual_minute" >= 0 AND "actual_minute" < 1440)),
    CONSTRAINT "med_admin_log_note_non_blank_check"
        CHECK ("note" IS NULL OR length(btrim("note")) > 0),
    CONSTRAINT "med_admin_log_non_given_note_check"
        CHECK ("outcome" = 'GIVEN' OR ("note" IS NOT NULL AND length(btrim("note")) > 0)),
    CONSTRAINT "med_admin_log_correction_note_check"
        CHECK ("correction_of_log_id" IS NULL OR ("note" IS NOT NULL AND length(btrim("note")) > 0))
);

CREATE INDEX "medication_request_campus_status_start_idx"
    ON "medication_request"("campus_id", "status", "start_date");

CREATE INDEX "medication_request_student_date_idx"
    ON "medication_request"("campus_id", "student_id", "start_date", "end_date");

CREATE INDEX "medication_request_guardian_history_idx"
    ON "medication_request"("requester_guardian_id", "created_at");

CREATE UNIQUE INDEX "medication_request_id_scope_unique"
    ON "medication_request"("id", "campus_id", "student_id");

CREATE INDEX "medication_request_requester_user_id_idx"
    ON "medication_request"("requester_user_id");

CREATE INDEX "medication_request_reviewed_by_user_id_idx"
    ON "medication_request"("reviewed_by_user_id");

CREATE INDEX "medication_request_item_request_id_idx"
    ON "medication_request_item"("request_id");

CREATE INDEX "medication_request_item_medication_name_idx"
    ON "medication_request_item"("medication_name");

CREATE UNIQUE INDEX "medication_request_item_request_id_unique"
    ON "medication_request_item"("request_id", "id");

CREATE UNIQUE INDEX "med_admin_occurrence_item_due_unique"
    ON "medication_administration_occurrence"("medication_item_id", "due_date", "due_minute");

CREATE INDEX "med_admin_occurrence_daily_idx"
    ON "medication_administration_occurrence"("campus_id", "due_date", "due_minute");

CREATE INDEX "med_admin_occurrence_student_daily_idx"
    ON "medication_administration_occurrence"("campus_id", "student_id", "due_date");

CREATE INDEX "medication_administration_occurrence_request_id_idx"
    ON "medication_administration_occurrence"("request_id");

CREATE INDEX "medication_administration_occurrence_latest_outcome_idx"
    ON "medication_administration_occurrence"("latest_outcome");

CREATE INDEX "medication_administration_occurrence_latest_log_id_idx"
    ON "medication_administration_occurrence"("latest_log_id");

CREATE INDEX "med_admin_occurrence_latest_user_idx"
    ON "medication_administration_occurrence"("latest_recorded_by_user_id");

CREATE INDEX "med_admin_log_occurrence_recorded_idx"
    ON "medication_administration_log"("occurrence_id", "recorded_at");

CREATE UNIQUE INDEX "med_admin_log_occurrence_id_unique"
    ON "medication_administration_log"("occurrence_id", "id");

CREATE INDEX "medication_administration_log_recorded_by_user_id_idx"
    ON "medication_administration_log"("recorded_by_user_id");

CREATE INDEX "medication_administration_log_correction_of_log_id_idx"
    ON "medication_administration_log"("correction_of_log_id");

ALTER TABLE "medication_request"
    ADD CONSTRAINT "medication_request_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_request"
    ADD CONSTRAINT "medication_request_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_request"
    ADD CONSTRAINT "medication_request_requester_guardian_id_fkey"
    FOREIGN KEY ("requester_guardian_id") REFERENCES "guardian"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_request"
    ADD CONSTRAINT "medication_request_requester_user_id_fkey"
    FOREIGN KEY ("requester_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medication_request"
    ADD CONSTRAINT "medication_request_reviewed_by_user_id_fkey"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medication_request_item"
    ADD CONSTRAINT "medication_request_item_request_id_fkey"
    FOREIGN KEY ("request_id") REFERENCES "medication_request"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_administration_occurrence"
    ADD CONSTRAINT "med_admin_occurrence_request_id_fkey"
    FOREIGN KEY ("request_id", "campus_id", "student_id") REFERENCES "medication_request"("id", "campus_id", "student_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_administration_occurrence"
    ADD CONSTRAINT "med_admin_occurrence_medication_item_id_fkey"
    FOREIGN KEY ("request_id", "medication_item_id") REFERENCES "medication_request_item"("request_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_administration_occurrence"
    ADD CONSTRAINT "med_admin_occurrence_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_administration_occurrence"
    ADD CONSTRAINT "med_admin_occurrence_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "student"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_administration_occurrence"
    ADD CONSTRAINT "med_admin_occurrence_latest_recorded_by_user_id_fkey"
    FOREIGN KEY ("latest_recorded_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medication_administration_log"
    ADD CONSTRAINT "med_admin_log_occurrence_id_fkey"
    FOREIGN KEY ("occurrence_id") REFERENCES "medication_administration_occurrence"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_administration_log"
    ADD CONSTRAINT "med_admin_log_recorded_by_user_id_fkey"
    FOREIGN KEY ("recorded_by_user_id") REFERENCES "user"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_administration_log"
    ADD CONSTRAINT "med_admin_log_correction_of_log_id_fkey"
    FOREIGN KEY ("occurrence_id", "correction_of_log_id") REFERENCES "medication_administration_log"("occurrence_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "medication_administration_occurrence"
    ADD CONSTRAINT "med_admin_occurrence_latest_log_id_fkey"
    FOREIGN KEY ("id", "latest_log_id") REFERENCES "medication_administration_log"("occurrence_id", "id")
    ON DELETE NO ACTION ON UPDATE NO ACTION;
