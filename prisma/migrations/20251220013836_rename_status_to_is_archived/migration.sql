/*
  Warnings:

  - You are about to drop the column `status` on the `school_year` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."school_year_status_idx";

-- AlterTable
ALTER TABLE "grade_level" ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "school_year" DROP COLUMN "status",
ADD COLUMN     "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "grade_level_is_archived_idx" ON "grade_level"("is_archived");

-- CreateIndex
CREATE INDEX "school_year_is_archived_idx" ON "school_year"("is_archived");
