ALTER TABLE "medication_request"
ADD COLUMN "completed_at" TIMESTAMPTZ(6),
ADD COLUMN "expired_at" TIMESTAMPTZ(6);

UPDATE "medication_request"
SET "completed_at" = "updated_at"
WHERE "status" = 'COMPLETED'
  AND "completed_at" IS NULL;

UPDATE "medication_request"
SET "expired_at" = "updated_at"
WHERE "status" = 'EXPIRED'
  AND "expired_at" IS NULL;
