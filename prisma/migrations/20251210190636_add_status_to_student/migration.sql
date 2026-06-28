-- AlterTable
ALTER TABLE "student" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'WAITING';

-- CreateIndex
CREATE INDEX "student_status_idx" ON "student"("status");
