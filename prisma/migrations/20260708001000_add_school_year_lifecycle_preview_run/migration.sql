CREATE TABLE "school_year_lifecycle_preview_run" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campus_id" UUID NOT NULL,
  "source_school_year_id" UUID NOT NULL,
  "target_school_year_id" UUID NOT NULL,
  "source_closure_date" DATE NOT NULL,
  "target_enrollment_date" DATE NOT NULL,
  "digest" TEXT NOT NULL,
  "request_payload" JSONB NOT NULL,
  "result_payload" JSONB NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "school_year_lifecycle_preview_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_year_lifecycle_preview_lookup_idx"
  ON "school_year_lifecycle_preview_run"(
    "campus_id",
    "source_school_year_id",
    "target_school_year_id",
    "created_at" DESC
  );

CREATE INDEX "school_year_lifecycle_preview_digest_idx"
  ON "school_year_lifecycle_preview_run"("digest");

ALTER TABLE "school_year_lifecycle_preview_run"
  ADD CONSTRAINT "school_year_lifecycle_preview_run_campus_id_fkey"
  FOREIGN KEY ("campus_id") REFERENCES "campus"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school_year_lifecycle_preview_run"
  ADD CONSTRAINT "school_year_lifecycle_preview_run_source_school_year_id_fkey"
  FOREIGN KEY ("source_school_year_id") REFERENCES "school_year"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school_year_lifecycle_preview_run"
  ADD CONSTRAINT "school_year_lifecycle_preview_run_target_school_year_id_fkey"
  FOREIGN KEY ("target_school_year_id") REFERENCES "school_year"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school_year_lifecycle_preview_run"
  ADD CONSTRAINT "school_year_lifecycle_preview_run_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
