BEGIN;
SET LOCAL lock_timeout = '5s';

-- Block approval-request writes for this transaction so no duplicate can enter
-- between cleanup and unique-index enforcement. Reads remain available.
LOCK TABLE "post_approval_request" IN SHARE MODE;

-- Preserve every approval row. For legacy posts with duplicate pending rows,
-- retain the newest request and close older duplicates without inventing a
-- reviewer or review timestamp.
WITH "ranked_pending" AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "post_id"
      ORDER BY "submitted_at" DESC, "created_at" DESC, "id" DESC
    ) AS "pending_rank"
  FROM "post_approval_request"
  WHERE "status" = 'PENDING'
)
UPDATE "post_approval_request" AS "request"
SET
  "status" = 'REJECTED',
  "reviewed_by_id" = NULL,
  "reviewed_at" = NULL,
  "review_note" = CASE
    WHEN "request"."review_note" IS NULL OR btrim("request"."review_note") = ''
      THEN 'Superseded by a newer pending approval request during integrity migration'
    ELSE "request"."review_note" || E'\nSuperseded by a newer pending approval request during integrity migration'
  END
FROM "ranked_pending"
WHERE "request"."id" = "ranked_pending"."id"
  AND "ranked_pending"."pending_rank" > 1;

-- Prisma cannot represent a partial unique index in schema.prisma. Cleanup and
-- enforcement stay in one transaction; the explicit lock closes the race.
CREATE UNIQUE INDEX "post_approval_request_one_pending_per_post_key"
ON "post_approval_request"("post_id")
WHERE "status" = 'PENDING';

COMMIT;
