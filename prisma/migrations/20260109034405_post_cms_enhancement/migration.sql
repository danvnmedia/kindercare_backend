/*
  Warnings:

  - The `content` column on the `post` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `audience` on the `post_history` table. All the data in the column will be lost.
  - You are about to drop the column `author_id` on the `post_history` table. All the data in the column will be lost.
  - You are about to drop the column `publish_at` on the `post_history` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `post_history` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `post_history` table. All the data in the column will be lost.
  - The `content` column on the `post_history` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `comment` on the `post_history_status` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `post_history_status` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `post_history_status` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `post_history_status` table. All the data in the column will be lost.
  - Added the required column `edited_by_id` to the `post_history` table without a default value. This is not possible if the table is not empty.
  - Added the required column `changed_by_id` to the `post_history_status` table without a default value. This is not possible if the table is not empty.
  - Added the required column `new_status` to the `post_history_status` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."post_history" DROP CONSTRAINT "post_history_author_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."post_history_status" DROP CONSTRAINT "post_history_status_user_id_fkey";

-- DropIndex
DROP INDEX "public"."post_history_author_id_idx";

-- DropIndex
DROP INDEX "public"."post_history_status_status_idx";

-- DropIndex
DROP INDEX "public"."post_history_status_user_id_idx";

-- AlterTable
ALTER TABLE "post" ADD COLUMN     "content_text" TEXT,
ADD COLUMN     "content_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_pinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinned_by_id" UUID,
ADD COLUMN     "pinned_until" TIMESTAMPTZ(6),
ADD COLUMN     "requires_approval" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "content",
ADD COLUMN     "content" JSONB;

-- AlterTable
ALTER TABLE "post_history" DROP COLUMN "audience",
DROP COLUMN "author_id",
DROP COLUMN "publish_at",
DROP COLUMN "status",
DROP COLUMN "updated_at",
ADD COLUMN     "edited_by_id" UUID NOT NULL,
DROP COLUMN "content",
ADD COLUMN     "content" JSONB;

-- AlterTable
ALTER TABLE "post_history_status" DROP COLUMN "comment",
DROP COLUMN "status",
DROP COLUMN "updated_at",
DROP COLUMN "user_id",
ADD COLUMN     "changed_by_id" UUID NOT NULL,
ADD COLUMN     "new_status" TEXT NOT NULL,
ADD COLUMN     "previous_status" TEXT,
ADD COLUMN     "reason" TEXT;

-- CreateTable
CREATE TABLE "post_category" (
    "id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "post_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_category_link" (
    "post_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_category_link_pkey" PRIMARY KEY ("post_id","category_id")
);

-- CreateTable
CREATE TABLE "post_reaction" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_comment" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "post_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_approval_request" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" TEXT,
    "title_snapshot" TEXT NOT NULL,
    "content_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campus_setting" (
    "id" UUID NOT NULL,
    "campus_id" UUID NOT NULL,
    "require_teacher_approval" BOOLEAN NOT NULL DEFAULT true,
    "max_pinned_posts" INTEGER NOT NULL DEFAULT 3,
    "allow_parent_comments" BOOLEAN NOT NULL DEFAULT true,
    "allow_reactions" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "campus_setting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_category_campus_id_is_active_idx" ON "post_category"("campus_id", "is_active");

-- CreateIndex
CREATE INDEX "post_category_campus_id_order_idx" ON "post_category"("campus_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "post_category_campus_id_name_key" ON "post_category"("campus_id", "name");

-- CreateIndex
CREATE INDEX "post_category_link_category_id_idx" ON "post_category_link"("category_id");

-- CreateIndex
CREATE INDEX "post_reaction_post_id_idx" ON "post_reaction"("post_id");

-- CreateIndex
CREATE INDEX "post_reaction_user_id_idx" ON "post_reaction"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "post_reaction_post_id_user_id_key" ON "post_reaction"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "post_comment_post_id_created_at_idx" ON "post_comment"("post_id", "created_at");

-- CreateIndex
CREATE INDEX "post_comment_post_id_parent_comment_id_idx" ON "post_comment"("post_id", "parent_comment_id");

-- CreateIndex
CREATE INDEX "post_comment_parent_comment_id_idx" ON "post_comment"("parent_comment_id");

-- CreateIndex
CREATE INDEX "post_comment_user_id_idx" ON "post_comment"("user_id");

-- CreateIndex
CREATE INDEX "post_comment_is_deleted_idx" ON "post_comment"("is_deleted");

-- CreateIndex
CREATE INDEX "post_comment_depth_idx" ON "post_comment"("depth");

-- CreateIndex
CREATE INDEX "post_approval_request_post_id_idx" ON "post_approval_request"("post_id");

-- CreateIndex
CREATE INDEX "post_approval_request_status_submitted_at_idx" ON "post_approval_request"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "post_approval_request_submitted_by_id_idx" ON "post_approval_request"("submitted_by_id");

-- CreateIndex
CREATE INDEX "post_approval_request_reviewed_by_id_idx" ON "post_approval_request"("reviewed_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "campus_setting_campus_id_key" ON "campus_setting"("campus_id");

-- CreateIndex
CREATE INDEX "post_campus_id_status_publish_at_idx" ON "post"("campus_id", "status", "publish_at");

-- CreateIndex
CREATE INDEX "post_campus_id_is_pinned_idx" ON "post"("campus_id", "is_pinned");

-- CreateIndex
CREATE INDEX "post_is_deleted_idx" ON "post"("is_deleted");

-- CreateIndex
CREATE INDEX "post_history_edited_by_id_idx" ON "post_history"("edited_by_id");

-- CreateIndex
CREATE INDEX "post_history_status_changed_by_id_idx" ON "post_history_status"("changed_by_id");

-- CreateIndex
CREATE INDEX "post_history_status_new_status_idx" ON "post_history_status"("new_status");

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_pinned_by_id_fkey" FOREIGN KEY ("pinned_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_history" ADD CONSTRAINT "post_history_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_history_status" ADD CONSTRAINT "post_history_status_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_category" ADD CONSTRAINT "post_category_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_category_link" ADD CONSTRAINT "post_category_link_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_category_link" ADD CONSTRAINT "post_category_link_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "post_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reaction" ADD CONSTRAINT "post_reaction_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reaction" ADD CONSTRAINT "post_reaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "post_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_approval_request" ADD CONSTRAINT "post_approval_request_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_approval_request" ADD CONSTRAINT "post_approval_request_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_approval_request" ADD CONSTRAINT "post_approval_request_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campus_setting" ADD CONSTRAINT "campus_setting_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
