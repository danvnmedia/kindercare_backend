-- Phase 1: add nullable columns only. This is a metadata-only change.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "post"
ADD COLUMN IF NOT EXISTS "client_mutation_id" UUID,
ADD COLUMN IF NOT EXISTS "request_payload_hash" VARCHAR(64);
COMMIT;

-- Phase 2: set DB defaults after column creation. Prisma uses matching
-- dbgenerated expressions in schema.prisma.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "post"
ALTER COLUMN "client_mutation_id" SET DEFAULT gen_random_uuid(),
ALTER COLUMN "request_payload_hash" SET DEFAULT encode(sha256(convert_to('{}', 'UTF8')), 'hex');
COMMIT;

-- Phase 3: existing rows predate client-visible mutation IDs. Give them
-- unreachable keys and deterministic legacy marker hashes, not fabricated
-- request payloads.
BEGIN;
SET LOCAL lock_timeout = '5s';
UPDATE "post"
SET
  "client_mutation_id" = COALESCE("client_mutation_id", gen_random_uuid()),
  "request_payload_hash" = COALESCE(
    "request_payload_hash",
    encode(
      sha256(convert_to('legacy-post:' || "id"::text, 'UTF8')),
      'hex'
    )
  )
WHERE "client_mutation_id" IS NULL
   OR "request_payload_hash" IS NULL;
COMMIT;

-- Phase 4: NOT VALID avoids scanning the populated table while adding checks.
-- New and updated rows must satisfy the checks immediately.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_client_mutation_id_not_null'
      AND conrelid = 'post'::regclass
  ) THEN
    ALTER TABLE "post"
    ADD CONSTRAINT "post_client_mutation_id_not_null"
    CHECK ("client_mutation_id" IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_request_payload_hash_not_null'
      AND conrelid = 'post'::regclass
  ) THEN
    ALTER TABLE "post"
    ADD CONSTRAINT "post_request_payload_hash_not_null"
    CHECK ("request_payload_hash" IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'post_request_payload_hash_sha256'
      AND conrelid = 'post'::regclass
  ) THEN
    ALTER TABLE "post"
    ADD CONSTRAINT "post_request_payload_hash_sha256"
    CHECK ("request_payload_hash" ~ '^[0-9a-f]{64}$') NOT VALID;
  END IF;
END $$;
COMMIT;

-- Phase 5: validation permits ordinary reads and writes while scanning rows.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "post"
VALIDATE CONSTRAINT "post_client_mutation_id_not_null";
ALTER TABLE "post"
VALIDATE CONSTRAINT "post_request_payload_hash_not_null";
ALTER TABLE "post"
VALIDATE CONSTRAINT "post_request_payload_hash_sha256";
COMMIT;

-- Phase 6: PostgreSQL reuses the validated checks, avoiding another scan while
-- converting columns to NOT NULL. The SHA-256 format check remains durable.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "post"
ALTER COLUMN "client_mutation_id" SET NOT NULL,
ALTER COLUMN "request_payload_hash" SET NOT NULL,
DROP CONSTRAINT IF EXISTS "post_client_mutation_id_not_null",
DROP CONSTRAINT IF EXISTS "post_request_payload_hash_not_null";
COMMIT;

-- Scoped uniqueness is built CONCURRENTLY by the immediately following
-- one-statement migration. Prisma/PostgreSQL cannot run that command inside
-- this migration's multi-statement transaction.
