-- Remove legacy CMS post audience scopes that are no longer part of the product contract.
-- Posts are now targeted only to the whole campus (ALL) or selected classes (CLASS).

DELETE FROM "post_audience"
WHERE "type" IN ('GRADE', 'STUDENT');

DROP INDEX IF EXISTS "post_audience_student_id_idx";
DROP INDEX IF EXISTS "post_audience_grade_level_id_idx";

ALTER TABLE "post_audience" DROP CONSTRAINT IF EXISTS "post_audience_student_id_fkey";
ALTER TABLE "post_audience" DROP CONSTRAINT IF EXISTS "post_audience_grade_level_id_fkey";

ALTER TABLE "post_audience" DROP COLUMN IF EXISTS "student_id";
ALTER TABLE "post_audience" DROP COLUMN IF EXISTS "grade_level_id";
