/*
  Warnings:

  - A unique constraint covering the columns `[key]` on the table `file` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "file" ADD COLUMN     "bucket" TEXT,
ADD COLUMN     "extension" TEXT,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storage_provider" TEXT NOT NULL DEFAULT 'LOCAL';

-- CreateIndex
CREATE UNIQUE INDEX "file_key_key" ON "file"("key");

-- CreateIndex
CREATE INDEX "file_key_idx" ON "file"("key");

-- CreateIndex
CREATE INDEX "file_is_deleted_idx" ON "file"("is_deleted");
