/*
  Warnings:

  - You are about to drop the `student_attendance` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."student_attendance" DROP CONSTRAINT "student_attendance_campus_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."student_attendance" DROP CONSTRAINT "student_attendance_class_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."student_attendance" DROP CONSTRAINT "student_attendance_student_id_fkey";

-- DropTable
DROP TABLE "public"."student_attendance";

-- CreateTable
CREATE TABLE "student_attendance_summary" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "first_checkin_at" TIMESTAMPTZ(6),
    "last_checkout_at" TIMESTAMPTZ(6),
    "total_minutes_present" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" UUID,
    "note" TEXT,
    "campus_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_attendance_summary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance_log" (
    "id" UUID NOT NULL,
    "attendance_summary_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    "method" TEXT NOT NULL,
    "device_id" TEXT,
    "created_by_id" UUID,
    "note" TEXT,
    "image_file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_attendance_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_attendance_summary_campus_id_idx" ON "student_attendance_summary"("campus_id");

-- CreateIndex
CREATE INDEX "student_attendance_summary_class_id_idx" ON "student_attendance_summary"("class_id");

-- CreateIndex
CREATE INDEX "student_attendance_summary_date_idx" ON "student_attendance_summary"("date");

-- CreateIndex
CREATE INDEX "student_attendance_summary_status_idx" ON "student_attendance_summary"("status");

-- CreateIndex
CREATE INDEX "student_attendance_summary_campus_id_date_status_idx" ON "student_attendance_summary"("campus_id", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_summary_student_id_date_key" ON "student_attendance_summary"("student_id", "date");

-- CreateIndex
CREATE INDEX "student_attendance_log_attendance_summary_id_idx" ON "student_attendance_log"("attendance_summary_id");

-- CreateIndex
CREATE INDEX "student_attendance_log_timestamp_idx" ON "student_attendance_log"("timestamp");

-- CreateIndex
CREATE INDEX "student_attendance_log_created_by_id_idx" ON "student_attendance_log"("created_by_id");

-- AddForeignKey
ALTER TABLE "student_attendance_summary" ADD CONSTRAINT "student_attendance_summary_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_summary" ADD CONSTRAINT "student_attendance_summary_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_summary" ADD CONSTRAINT "student_attendance_summary_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_summary" ADD CONSTRAINT "student_attendance_summary_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_log" ADD CONSTRAINT "student_attendance_log_attendance_summary_id_fkey" FOREIGN KEY ("attendance_summary_id") REFERENCES "student_attendance_summary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_log" ADD CONSTRAINT "student_attendance_log_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance_log" ADD CONSTRAINT "student_attendance_log_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE CASCADE;
