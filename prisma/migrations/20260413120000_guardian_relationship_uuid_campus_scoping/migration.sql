-- Guardian Relationship: Convert from global plain-string ID to campus-scoped UUID
-- Preserve legacy guardian_student relationship refs (e.g. FATHER/MOTHER) while
-- converting to campus-scoped UUID rows.

-- ============================================
-- Step 1: Drop FK from guardian_student
-- ============================================
ALTER TABLE "guardian_student" DROP CONSTRAINT IF EXISTS "guardian_student_guardian_relationship_id_fkey";

-- Drop indexes on guardian_student.guardian_relationship_id
DROP INDEX IF EXISTS "guardian_student_guardian_relationship_id_idx";

-- Preserve legacy relationship codes before replacing the table.
CREATE TEMP TABLE "guardian_relationship_legacy_map" AS
SELECT
    "id" AS "legacy_id",
    "name",
    "description",
    ROW_NUMBER() OVER (ORDER BY "name") AS "order"
FROM "guardian_relationship";

-- ============================================
-- Step 2: Drop the old guardian_relationship table
-- ============================================
DROP TABLE IF EXISTS "guardian_relationship";

-- ============================================
-- Step 3: Recreate guardian_relationship with new schema
-- ============================================
CREATE TABLE "guardian_relationship" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campus_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "legacy_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardian_relationship_pkey" PRIMARY KEY ("id")
);

INSERT INTO "guardian_relationship" ("campus_id", "name", "description", "order", "legacy_id", "updated_at")
SELECT
    "campus"."id",
    "legacy"."name",
    "legacy"."description",
    "legacy"."order",
    "legacy"."legacy_id",
    CURRENT_TIMESTAMP
FROM "campus"
CROSS JOIN "guardian_relationship_legacy_map" "legacy";

-- ============================================
-- Step 4: Add constraints and indexes
-- ============================================
-- Campus-scoped unique constraints
CREATE UNIQUE INDEX "guardian_relationship_campus_id_name_key" ON "guardian_relationship"("campus_id", "name");
CREATE UNIQUE INDEX "guardian_relationship_campus_id_order_key" ON "guardian_relationship"("campus_id", "order");

-- Performance indexes
CREATE INDEX "guardian_relationship_campus_id_idx" ON "guardian_relationship"("campus_id");
CREATE INDEX "guardian_relationship_order_idx" ON "guardian_relationship"("order");

-- FK to campus
ALTER TABLE "guardian_relationship" ADD CONSTRAINT "guardian_relationship_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- Step 5: Update guardian_student FK column to UUID
-- ============================================
-- Map each existing guardian/student link to the relationship row for the student's campus.
UPDATE "guardian_student" "gs"
SET "guardian_relationship_id" = "gr"."id"::text
FROM "student" "s"
JOIN "guardian_relationship" "gr" ON "gr"."campus_id" = "s"."campus_id"
WHERE "s"."id" = "gs"."student_id"
  AND "gr"."legacy_id" = "gs"."guardian_relationship_id";

ALTER TABLE "guardian_relationship" DROP COLUMN "legacy_id";

-- Change column type from TEXT to UUID after legacy refs are converted.
ALTER TABLE "guardian_student" ALTER COLUMN "guardian_relationship_id" SET DATA TYPE UUID USING "guardian_relationship_id"::uuid;

-- Recreate FK and index
CREATE INDEX "guardian_student_guardian_relationship_id_idx" ON "guardian_student"("guardian_relationship_id");
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_guardian_relationship_id_fkey" FOREIGN KEY ("guardian_relationship_id") REFERENCES "guardian_relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
