-- AlterTable
ALTER TABLE "post_audience" ADD COLUMN     "grade_level_id" UUID;

-- CreateIndex
CREATE INDEX "post_audience_grade_level_id_idx" ON "post_audience"("grade_level_id");

-- AddForeignKey
ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
