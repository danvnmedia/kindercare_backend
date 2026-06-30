-- Prevent concurrent duplicate file attachments on the same post.
CREATE UNIQUE INDEX "attachment_post_id_file_id_key" ON "attachment"("post_id", "file_id");
