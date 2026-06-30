/*
  Warnings:

  - A unique constraint covering the columns `[campus_id,staff_code]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `staff_code` to the `staff` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "staff" ADD COLUMN "staff_code" TEXT;

-- Backfill existing staff before enforcing NOT NULL.
WITH numbered_staff AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (PARTITION BY "campus_id" ORDER BY "created_at", "id") AS row_number
    FROM "staff"
)
UPDATE "staff"
SET "staff_code" = 'STF' || LPAD(numbered_staff.row_number::text, 5, '0')
FROM numbered_staff
WHERE "staff"."id" = numbered_staff."id";

ALTER TABLE "staff" ALTER COLUMN "staff_code" SET NOT NULL;

-- CreateTable
CREATE TABLE "staff_code_sequence" (
    "campus_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_code_sequence_pkey" PRIMARY KEY ("campus_id", "year")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_campus_id_staff_code_key" ON "staff"("campus_id", "staff_code");

-- AddForeignKey
ALTER TABLE "staff_code_sequence" ADD CONSTRAINT "staff_code_sequence_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
