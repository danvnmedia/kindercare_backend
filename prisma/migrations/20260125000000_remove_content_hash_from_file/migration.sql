-- Remove contentHash column and related indexes from file table
-- This column was never populated (dead code)

-- Drop indexes first
DROP INDEX IF EXISTS "file_content_hash_idx";
DROP INDEX IF EXISTS "file_campus_id_content_hash_idx";

-- Drop the column
ALTER TABLE "file" DROP COLUMN IF EXISTS "content_hash";
