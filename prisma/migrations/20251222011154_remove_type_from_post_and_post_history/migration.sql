/*
  Warnings:

  - You are about to drop the column `type` on the `post` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `post_history` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."post_type_idx";

-- AlterTable
ALTER TABLE "post" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "post_history" DROP COLUMN "type";
