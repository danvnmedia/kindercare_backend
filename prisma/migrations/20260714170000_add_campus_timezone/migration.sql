ALTER TABLE "campus" ADD COLUMN "time_zone" TEXT;

UPDATE "campus"
SET "time_zone" = 'Asia/Ho_Chi_Minh'
WHERE "time_zone" IS NULL;

ALTER TABLE "campus" ALTER COLUMN "time_zone" SET NOT NULL;
