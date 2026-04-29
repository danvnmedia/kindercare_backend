-- Standardize isActive (default true) to isArchived (default false)
-- Affected tables: campus, staff_type, post_category

-- ============================================
-- Campus: rename + invert data + change default
-- ============================================
ALTER TABLE "campus" RENAME COLUMN "is_active" TO "is_archived";
ALTER TABLE "campus" ALTER COLUMN "is_archived" SET DEFAULT false;
UPDATE "campus" SET "is_archived" = NOT "is_archived";

-- ============================================
-- StaffType: rename + invert data + change default
-- ============================================
ALTER TABLE "staff_type" RENAME COLUMN "is_active" TO "is_archived";
ALTER TABLE "staff_type" ALTER COLUMN "is_archived" SET DEFAULT false;
UPDATE "staff_type" SET "is_archived" = NOT "is_archived";

-- ============================================
-- PostCategory: rename + change default (no data to invert)
-- ============================================
-- Drop existing index first (references old column name)
DROP INDEX IF EXISTS "post_category_campus_id_is_active_idx";

ALTER TABLE "post_category" RENAME COLUMN "is_active" TO "is_archived";
ALTER TABLE "post_category" ALTER COLUMN "is_archived" SET DEFAULT false;
UPDATE "post_category" SET "is_archived" = NOT "is_archived";

-- Recreate index with new column name
CREATE INDEX "post_category_campus_id_is_archived_idx" ON "post_category"("campus_id", "is_archived");
