/*
  Warnings:

  - A unique constraint covering the columns `[school_year_id,grade_level_id,name]` on the table `class` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `school_year_id` to the `class` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."class_grade_level_id_name_key";

-- AlterTable
ALTER TABLE "class" ADD COLUMN     "description" TEXT,
ADD COLUMN     "school_year_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "school_year" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "school_year_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_year_name_key" ON "school_year"("name");

-- CreateIndex
CREATE INDEX "school_year_status_idx" ON "school_year"("status");

-- CreateIndex
CREATE INDEX "class_school_year_id_idx" ON "class"("school_year_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_school_year_id_grade_level_id_name_key" ON "class"("school_year_id", "grade_level_id", "name");

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_school_year_id_fkey" FOREIGN KEY ("school_year_id") REFERENCES "school_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
