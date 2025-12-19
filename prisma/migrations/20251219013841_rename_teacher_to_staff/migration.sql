/*
  Warnings:

  - You are about to drop the `class_teacher` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `teacher` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."class_teacher" DROP CONSTRAINT "class_teacher_class_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."class_teacher" DROP CONSTRAINT "class_teacher_subject_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."class_teacher" DROP CONSTRAINT "class_teacher_teacher_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."teacher" DROP CONSTRAINT "teacher_user_id_fkey";

-- DropTable
DROP TABLE "public"."class_teacher";

-- DropTable
DROP TABLE "public"."teacher";

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "address" TEXT,
    "date_of_birth" DATE,
    "gender" TEXT,
    "start_date" DATE,
    "staff_type" TEXT NOT NULL DEFAULT 'TEACHER',
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_staff" (
    "class_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "class_staff_pkey" PRIMARY KEY ("class_id","staff_id","subject_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_phone_number_key" ON "staff"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "staff_user_id_key" ON "staff"("user_id");

-- CreateIndex
CREATE INDEX "staff_email_idx" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_phone_number_idx" ON "staff"("phone_number");

-- CreateIndex
CREATE INDEX "staff_user_id_idx" ON "staff"("user_id");

-- CreateIndex
CREATE INDEX "staff_is_archived_idx" ON "staff"("is_archived");

-- CreateIndex
CREATE INDEX "staff_staff_type_idx" ON "staff"("staff_type");

-- CreateIndex
CREATE INDEX "class_staff_staff_id_idx" ON "class_staff"("staff_id");

-- CreateIndex
CREATE INDEX "class_staff_subject_id_idx" ON "class_staff"("subject_id");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_staff" ADD CONSTRAINT "class_staff_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_staff" ADD CONSTRAINT "class_staff_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_staff" ADD CONSTRAINT "class_staff_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
