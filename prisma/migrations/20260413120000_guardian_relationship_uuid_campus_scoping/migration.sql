-- Guardian Relationship: Convert from global plain-string ID to campus-scoped UUID
-- Table is currently empty — schema-only migration, no data migration needed.

-- ============================================
-- Step 1: Drop FK from guardian_student
-- ============================================
ALTER TABLE "guardian_student" DROP CONSTRAINT IF EXISTS "guardian_student_guardian_relationship_id_fkey";

-- Drop indexes on guardian_student.guardian_relationship_id
DROP INDEX IF EXISTS "guardian_student_guardian_relationship_id_idx";

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
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardian_relationship_pkey" PRIMARY KEY ("id")
);

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
-- Change column type from TEXT to UUID
ALTER TABLE "guardian_student" ALTER COLUMN "guardian_relationship_id" SET DATA TYPE UUID USING "guardian_relationship_id"::uuid;

-- Recreate FK and index
CREATE INDEX "guardian_student_guardian_relationship_id_idx" ON "guardian_student"("guardian_relationship_id");
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_guardian_relationship_id_fkey" FOREIGN KEY ("guardian_relationship_id") REFERENCES "guardian_relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
