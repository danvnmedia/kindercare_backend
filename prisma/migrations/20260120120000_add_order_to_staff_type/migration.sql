-- AlterTable: Add order column to staff_type (nullable first for data migration)
ALTER TABLE "staff_type" ADD COLUMN "order" INTEGER;

-- Populate order values for existing staff types
-- Each campus gets sequential order values starting from 1
WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY campus_id ORDER BY name ASC) as new_order
  FROM "staff_type"
)
UPDATE "staff_type" st
SET "order" = o.new_order
FROM ordered o
WHERE st.id = o.id;

-- Make order column NOT NULL after population
ALTER TABLE "staff_type" ALTER COLUMN "order" SET NOT NULL;

-- CreateIndex: Unique constraint on [campusId, order]
CREATE UNIQUE INDEX "staff_type_campus_id_order_key" ON "staff_type"("campus_id", "order");

-- CreateIndex: Index on order for query performance
CREATE INDEX "staff_type_order_idx" ON "staff_type"("order");
