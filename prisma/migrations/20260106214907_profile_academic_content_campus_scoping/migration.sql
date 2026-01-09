/*
  Warnings:

  - You are about to drop the column `spouse_id` on the `guardian` table. All the data in the column will be lost.
  - You are about to drop the column `staff_type` on the `staff` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[campus_id,school_year_id,grade_level_id,name]` on the table `class` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,name]` on the table `grade_level` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,order]` on the table `grade_level` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,email]` on the table `guardian` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,phone_number]` on the table `guardian` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,user_id]` on the table `guardian` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,name]` on the table `school_year` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,email]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,phone_number]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,user_id]` on the table `staff` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,student_code]` on the table `student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[campus_id,name]` on the table `subject` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `campus_id` to the `class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `file` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `grade_level` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `guardian` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `post` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `post_audience` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `school_year` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `staff` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `student` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `student_attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `campus_id` to the `subject` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."guardian" DROP CONSTRAINT "guardian_spouse_id_fkey";

-- DropIndex
DROP INDEX "public"."class_school_year_id_grade_level_id_name_key";

-- DropIndex
DROP INDEX "public"."grade_level_name_key";

-- DropIndex
DROP INDEX "public"."grade_level_order_key";

-- DropIndex
DROP INDEX "public"."guardian_email_idx";

-- DropIndex
DROP INDEX "public"."guardian_email_key";

-- DropIndex
DROP INDEX "public"."guardian_phone_number_idx";

-- DropIndex
DROP INDEX "public"."guardian_phone_number_key";

-- DropIndex
DROP INDEX "public"."guardian_spouse_id_idx";

-- DropIndex
DROP INDEX "public"."guardian_spouse_id_key";

-- DropIndex
DROP INDEX "public"."guardian_user_id_idx";

-- DropIndex
DROP INDEX "public"."guardian_user_id_key";

-- DropIndex
DROP INDEX "public"."school_year_name_key";

-- DropIndex
DROP INDEX "public"."staff_email_idx";

-- DropIndex
DROP INDEX "public"."staff_email_key";

-- DropIndex
DROP INDEX "public"."staff_phone_number_idx";

-- DropIndex
DROP INDEX "public"."staff_phone_number_key";

-- DropIndex
DROP INDEX "public"."staff_staff_type_idx";

-- DropIndex
DROP INDEX "public"."staff_user_id_idx";

-- DropIndex
DROP INDEX "public"."staff_user_id_key";

-- DropIndex
DROP INDEX "public"."student_student_code_key";

-- DropIndex
DROP INDEX "public"."subject_name_key";

-- AlterTable
ALTER TABLE "class" ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "file" ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "grade_level" ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "guardian" DROP COLUMN "spouse_id",
ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "post_audience" ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "school_year" ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "staff" DROP COLUMN "staff_type",
ADD COLUMN     "campus_id" UUID NOT NULL,
ADD COLUMN     "staff_type_id" UUID;

-- AlterTable
ALTER TABLE "student" ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "student_attendance" ADD COLUMN     "campus_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "subject" ADD COLUMN     "campus_id" UUID NOT NULL;

-- CreateIndex
CREATE INDEX "class_campus_id_idx" ON "class"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_campus_id_school_year_id_grade_level_id_name_key" ON "class"("campus_id", "school_year_id", "grade_level_id", "name");

-- CreateIndex
CREATE INDEX "file_campus_id_idx" ON "file"("campus_id");

-- CreateIndex
CREATE INDEX "grade_level_campus_id_idx" ON "grade_level"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_level_campus_id_name_key" ON "grade_level"("campus_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "grade_level_campus_id_order_key" ON "grade_level"("campus_id", "order");

-- CreateIndex
CREATE INDEX "guardian_campus_id_idx" ON "guardian"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_campus_id_email_key" ON "guardian"("campus_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_campus_id_phone_number_key" ON "guardian"("campus_id", "phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_campus_id_user_id_key" ON "guardian"("campus_id", "user_id");

-- CreateIndex
CREATE INDEX "post_campus_id_idx" ON "post"("campus_id");

-- CreateIndex
CREATE INDEX "post_audience_campus_id_idx" ON "post_audience"("campus_id");

-- CreateIndex
CREATE INDEX "school_year_campus_id_idx" ON "school_year"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "school_year_campus_id_name_key" ON "school_year"("campus_id", "name");

-- CreateIndex
CREATE INDEX "staff_campus_id_idx" ON "staff"("campus_id");

-- CreateIndex
CREATE INDEX "staff_staff_type_id_idx" ON "staff"("staff_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_campus_id_email_key" ON "staff"("campus_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_campus_id_phone_number_key" ON "staff"("campus_id", "phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "staff_campus_id_user_id_key" ON "staff"("campus_id", "user_id");

-- CreateIndex
CREATE INDEX "student_campus_id_idx" ON "student"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_campus_id_student_code_key" ON "student"("campus_id", "student_code");

-- CreateIndex
CREATE INDEX "student_attendance_campus_id_idx" ON "student_attendance"("campus_id");

-- CreateIndex
CREATE INDEX "subject_campus_id_idx" ON "subject"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "subject_campus_id_name_key" ON "subject"("campus_id", "name");

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_staff_type_id_fkey" FOREIGN KEY ("staff_type_id") REFERENCES "staff_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_level" ADD CONSTRAINT "grade_level_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject" ADD CONSTRAINT "subject_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_year" ADD CONSTRAINT "school_year_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
