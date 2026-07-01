-- ============================================================================
-- Migration: add_medication_request_timeline
-- ============================================================================
-- Adds explicit request timeline rows for parent-visible medication request
-- history and follow-up responses.
-- ============================================================================

CREATE UNIQUE INDEX "medication_request_id_campus_unique"
    ON "medication_request"("id", "campus_id");

CREATE TABLE "medication_request_timeline_entry" (
    "id"                UUID NOT NULL,
    "request_id"        UUID NOT NULL,
    "campus_id"         UUID NOT NULL,
    "actor_type"        VARCHAR(30) NOT NULL,
    "actor_user_id"     UUID,
    "actor_guardian_id" UUID,
    "action"            VARCHAR(40) NOT NULL,
    "note"              TEXT,
    "created_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medication_request_timeline_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "med_request_timeline_actor_type_check"
        CHECK ("actor_type" IN ('GUARDIAN', 'STAFF', 'SYSTEM')),
    CONSTRAINT "med_request_timeline_action_check"
        CHECK ("action" IN ('SUBMITTED', 'CANCELLED', 'PARENT_RESPONDED')),
    CONSTRAINT "med_request_timeline_note_non_blank_check"
        CHECK ("note" IS NULL OR length(btrim("note")) > 0),
    CONSTRAINT "med_request_timeline_guardian_actor_check"
        CHECK ("actor_type" <> 'GUARDIAN' OR "actor_guardian_id" IS NOT NULL)
);

CREATE INDEX "med_request_timeline_request_created_idx"
    ON "medication_request_timeline_entry"("request_id", "created_at");

CREATE INDEX "med_request_timeline_campus_created_idx"
    ON "medication_request_timeline_entry"("campus_id", "created_at");

CREATE INDEX "med_request_timeline_actor_user_idx"
    ON "medication_request_timeline_entry"("actor_user_id");

CREATE INDEX "med_request_timeline_actor_guardian_idx"
    ON "medication_request_timeline_entry"("actor_guardian_id");

ALTER TABLE "medication_request_timeline_entry"
    ADD CONSTRAINT "med_request_timeline_request_id_fkey"
    FOREIGN KEY ("request_id", "campus_id") REFERENCES "medication_request"("id", "campus_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_request_timeline_entry"
    ADD CONSTRAINT "med_request_timeline_campus_id_fkey"
    FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "medication_request_timeline_entry"
    ADD CONSTRAINT "med_request_timeline_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medication_request_timeline_entry"
    ADD CONSTRAINT "med_request_timeline_actor_guardian_id_fkey"
    FOREIGN KEY ("actor_guardian_id") REFERENCES "guardian"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
