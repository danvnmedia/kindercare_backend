-- AlterTable
ALTER TABLE "teacher" ADD COLUMN     "teacher_type" TEXT NOT NULL DEFAULT 'TEACHER';

-- CreateIndex
CREATE INDEX "teacher_teacher_type_idx" ON "teacher"("teacher_type");
