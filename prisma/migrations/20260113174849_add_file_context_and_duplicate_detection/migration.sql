-- AlterTable
ALTER TABLE "file" ADD COLUMN     "audience_id" UUID,
ADD COLUMN     "audience_type" TEXT,
ADD COLUMN     "class_id" UUID,
ADD COLUMN     "content_hash" TEXT,
ADD COLUMN     "grade_level_id" UUID,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'GENERAL';

-- CreateIndex
CREATE INDEX "file_content_hash_idx" ON "file"("content_hash");

-- CreateIndex
CREATE INDEX "file_purpose_idx" ON "file"("purpose");

-- CreateIndex
CREATE INDEX "file_audience_type_idx" ON "file"("audience_type");

-- CreateIndex
CREATE INDEX "file_class_id_idx" ON "file"("class_id");

-- CreateIndex
CREATE INDEX "file_grade_level_id_idx" ON "file"("grade_level_id");

-- CreateIndex
CREATE INDEX "file_campus_id_content_hash_idx" ON "file"("campus_id", "content_hash");

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;
