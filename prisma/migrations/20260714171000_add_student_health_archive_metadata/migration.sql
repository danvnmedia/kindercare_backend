-- Add archive-only retention metadata to each Student Health record type.
ALTER TABLE "student_health_checkup"
    ADD COLUMN "archived_at" TIMESTAMPTZ(6),
    ADD COLUMN "archived_by_user_id" UUID;

ALTER TABLE "student_health_instruction"
    ADD COLUMN "archived_at" TIMESTAMPTZ(6),
    ADD COLUMN "archived_by_user_id" UUID;

ALTER TABLE "student_health_event"
    ADD COLUMN "archived_at" TIMESTAMPTZ(6),
    ADD COLUMN "archived_by_user_id" UUID;

-- Preserve legacy ARCHIVED events as archive metadata before narrowing their
-- clinical status to OPEN | RESOLVED. The latest update is the best available
-- historical archive context for records created before archive facts existed.
UPDATE "student_health_event"
SET
    "archived_at" = "updated_at",
    "archived_by_user_id" = "last_updated_by_user_id",
    "status" = 'RESOLVED'
WHERE "status" = 'ARCHIVED';

-- PostgreSQL enum values cannot be removed in place. Rebuild the type only
-- after every legacy ARCHIVED value has been rewritten.
ALTER TYPE "StudentHealthEventStatus" RENAME TO "StudentHealthEventStatus_old";
CREATE TYPE "StudentHealthEventStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TABLE "student_health_event"
    ALTER COLUMN "status" DROP DEFAULT,
    ALTER COLUMN "status" TYPE "StudentHealthEventStatus"
        USING ("status"::text::"StudentHealthEventStatus"),
    ALTER COLUMN "status" SET DEFAULT 'OPEN';

DROP TYPE "StudentHealthEventStatus_old";

-- Optional actor relations never cascade-delete health history.
ALTER TABLE "student_health_checkup"
    ADD CONSTRAINT "student_health_checkup_archived_by_user_id_fkey"
    FOREIGN KEY ("archived_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_health_instruction"
    ADD CONSTRAINT "student_health_instruction_archived_by_user_id_fkey"
    FOREIGN KEY ("archived_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_health_event"
    ADD CONSTRAINT "student_health_event_archived_by_user_id_fkey"
    FOREIGN KEY ("archived_by_user_id") REFERENCES "user"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing timeline indexes serve includeArchived history. These indexes add
-- archived_at to support the default active-only and Health Center scopes.
CREATE INDEX "student_health_checkup_archive_lookup_idx"
    ON "student_health_checkup"("campus_id", "student_id", "archived_at", "checked_at" DESC);
CREATE INDEX "student_health_checkup_archived_by_user_id_idx"
    ON "student_health_checkup"("archived_by_user_id");

CREATE INDEX "student_health_instruction_archive_lookup_idx"
    ON "student_health_instruction"("campus_id", "student_id", "archived_at", "start_date", "end_date");
CREATE INDEX "student_health_instruction_health_center_idx"
    ON "student_health_instruction"("campus_id", "archived_at", "is_active", "start_date", "end_date");
CREATE INDEX "student_health_instruction_archived_by_user_id_idx"
    ON "student_health_instruction"("archived_by_user_id");

CREATE INDEX "student_health_event_archive_timeline_idx"
    ON "student_health_event"("campus_id", "student_id", "archived_at", "occurred_at" DESC);
CREATE INDEX "student_health_event_health_center_idx"
    ON "student_health_event"("campus_id", "archived_at", "status", "occurred_at" DESC);
CREATE INDEX "student_health_event_archived_by_user_id_idx"
    ON "student_health_event"("archived_by_user_id");
