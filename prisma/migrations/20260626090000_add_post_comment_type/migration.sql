ALTER TABLE "post_comment"
  ADD COLUMN "comment_type" TEXT NOT NULL DEFAULT 'PUBLIC';

CREATE INDEX "post_comment_post_id_comment_type_created_at_idx"
  ON "post_comment"("post_id", "comment_type", "created_at");
