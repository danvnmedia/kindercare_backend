CREATE TABLE "school_year_lifecycle_run" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campus_id" UUID NOT NULL,
  "source_school_year_id" UUID NOT NULL,
  "target_school_year_id" UUID NOT NULL,
  "source_closure_date" DATE NOT NULL,
  "target_enrollment_date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID,
  "first_committed_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "expired_at" TIMESTAMPTZ(6),
  "retention_expires_at" TIMESTAMPTZ(6),
  "retention_policy_source" TEXT,
  "legal_hold" BOOLEAN NOT NULL DEFAULT false,
  "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "school_year_lifecycle_run_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_year_lifecycle_run_one_active_source_key"
  ON "school_year_lifecycle_run" ("campus_id", "source_school_year_id")
  WHERE "status" IN ('SETUP_INCOMPLETE', 'DRAFT', 'IN_PROGRESS', 'PARTIALLY_COMMITTED', 'NEEDS_RECONCILIATION');

CREATE INDEX "school_year_lifecycle_run_active_lookup_idx"
  ON "school_year_lifecycle_run" ("campus_id", "source_school_year_id", "status");
CREATE INDEX "school_year_lifecycle_run_expiry_idx"
  ON "school_year_lifecycle_run" ("campus_id", "last_activity_at");
CREATE INDEX "school_year_lifecycle_run_retention_idx"
  ON "school_year_lifecycle_run" ("status", "retention_expires_at", "legal_hold");
CREATE INDEX "school_year_lifecycle_run_target_school_year_id_idx"
  ON "school_year_lifecycle_run" ("target_school_year_id");

CREATE TABLE "school_year_lifecycle_candidate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lifecycle_run_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "source_school_year_enrollment_id" UUID NOT NULL,
  "source_enrollment_id" UUID,
  "source_grade_level_id" UUID NOT NULL,
  "source_class_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "recommended_outcome" TEXT NOT NULL,
  "decision" TEXT,
  "target_grade_level_id" UUID,
  "target_class_id" UUID,
  "decision_note" VARCHAR(500),
  "conflict_code" TEXT,
  "message" TEXT,
  "decision_updated_by_user_id" UUID,
  "decision_updated_at" TIMESTAMPTZ(6),
  "row_version" INTEGER NOT NULL DEFAULT 1,
  "committed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "school_year_lifecycle_candidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_year_lifecycle_candidate_run_student_key"
  ON "school_year_lifecycle_candidate" ("lifecycle_run_id", "student_id");
CREATE INDEX "school_year_lifecycle_candidate_filter_idx"
  ON "school_year_lifecycle_candidate" ("lifecycle_run_id", "status", "source_grade_level_id", "source_class_id");
CREATE INDEX "school_year_lifecycle_candidate_campus_id_student_id_idx"
  ON "school_year_lifecycle_candidate" ("campus_id", "student_id");
CREATE INDEX "school_year_lifecycle_candidate_target_class_id_idx"
  ON "school_year_lifecycle_candidate" ("target_class_id");

ALTER TABLE "school_year_lifecycle_preview_run"
  ADD COLUMN "lifecycle_run_id" UUID,
  ADD COLUMN "run_version" INTEGER,
  ADD COLUMN "scope_type" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "scope_identity" TEXT,
  ADD COLUMN "scope_payload" JSONB,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'VALID',
  ADD COLUMN "expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "invalidated_at" TIMESTAMPTZ(6),
  ADD COLUMN "superseded_at" TIMESTAMPTZ(6),
  ADD COLUMN "finalized_at" TIMESTAMPTZ(6),
  ADD COLUMN "updated_at" TIMESTAMPTZ(6);

UPDATE "school_year_lifecycle_preview_run"
SET "expires_at" = "created_at" + INTERVAL '24 hours',
    "updated_at" = "created_at";

ALTER TABLE "school_year_lifecycle_preview_run"
  ALTER COLUMN "expires_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET NOT NULL;

CREATE INDEX "school_year_lifecycle_preview_run_status_idx"
  ON "school_year_lifecycle_preview_run" ("lifecycle_run_id", "status", "expires_at");
CREATE INDEX "school_year_lifecycle_preview_run_scope_idx"
  ON "school_year_lifecycle_preview_run" ("lifecycle_run_id", "scope_identity", "status");

CREATE TABLE "school_year_lifecycle_preview_candidate" (
  "preview_run_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "normalized_row" JSONB NOT NULL,

  CONSTRAINT "school_year_lifecycle_preview_candidate_pkey"
    PRIMARY KEY ("preview_run_id", "candidate_id")
);

CREATE UNIQUE INDEX "school_year_lifecycle_preview_candidate_sequence_key"
  ON "school_year_lifecycle_preview_candidate" ("preview_run_id", "sequence");
CREATE INDEX "school_year_lifecycle_preview_candidate_candidate_id_idx"
  ON "school_year_lifecycle_preview_candidate" ("candidate_id");

CREATE TABLE "school_year_lifecycle_commit_attempt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "lifecycle_run_id" UUID NOT NULL,
  "preview_run_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "already_applied_count" INTEGER NOT NULL DEFAULT 0,
  "created_by_user_id" UUID NOT NULL,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "school_year_lifecycle_commit_attempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "school_year_lifecycle_commit_attempt_run_idx"
  ON "school_year_lifecycle_commit_attempt" ("lifecycle_run_id", "created_at" DESC);
CREATE INDEX "school_year_lifecycle_commit_attempt_preview_run_id_idx"
  ON "school_year_lifecycle_commit_attempt" ("preview_run_id");

CREATE TABLE "school_year_lifecycle_commit_row_result" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "commit_attempt_id" UUID NOT NULL,
  "lifecycle_candidate_id" UUID NOT NULL,
  "campus_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "target_class_id" UUID,
  "conflict_code" TEXT,
  "message" TEXT,
  "resulting_school_year_enrollment_id" UUID,
  "resulting_class_enrollment_id" UUID,
  "operations" JSONB NOT NULL,
  "context" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "school_year_lifecycle_commit_row_result_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_year_lifecycle_commit_row_attempt_candidate_key"
  ON "school_year_lifecycle_commit_row_result" ("commit_attempt_id", "lifecycle_candidate_id");
CREATE INDEX "school_year_lifecycle_commit_row_candidate_idx"
  ON "school_year_lifecycle_commit_row_result" ("lifecycle_candidate_id", "created_at" DESC);
CREATE INDEX "school_year_lifecycle_commit_row_result_campus_id_student_id_idx"
  ON "school_year_lifecycle_commit_row_result" ("campus_id", "student_id");

ALTER TABLE "school_year_lifecycle_run"
  ADD CONSTRAINT "school_year_lifecycle_run_campus_id_fkey"
  FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_run_source_school_year_id_fkey"
  FOREIGN KEY ("source_school_year_id") REFERENCES "school_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_run_target_school_year_id_fkey"
  FOREIGN KEY ("target_school_year_id") REFERENCES "school_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_run_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_run_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "school_year_lifecycle_candidate"
  ADD CONSTRAINT "school_year_lifecycle_candidate_lifecycle_run_id_fkey"
  FOREIGN KEY ("lifecycle_run_id") REFERENCES "school_year_lifecycle_run"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_campus_id_fkey"
  FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_source_school_year_enrollment_id_fkey"
  FOREIGN KEY ("source_school_year_enrollment_id") REFERENCES "school_year_enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_source_enrollment_id_fkey"
  FOREIGN KEY ("source_enrollment_id") REFERENCES "enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_source_grade_level_id_fkey"
  FOREIGN KEY ("source_grade_level_id") REFERENCES "grade_level"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_source_class_id_fkey"
  FOREIGN KEY ("source_class_id") REFERENCES "class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_target_grade_level_id_fkey"
  FOREIGN KEY ("target_grade_level_id") REFERENCES "grade_level"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_target_class_id_fkey"
  FOREIGN KEY ("target_class_id") REFERENCES "class"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_candidate_decision_updated_by_user_id_fkey"
  FOREIGN KEY ("decision_updated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "school_year_lifecycle_preview_run"
  ADD CONSTRAINT "school_year_lifecycle_preview_run_lifecycle_run_id_fkey"
  FOREIGN KEY ("lifecycle_run_id") REFERENCES "school_year_lifecycle_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "school_year_lifecycle_preview_candidate"
  ADD CONSTRAINT "school_year_lifecycle_preview_candidate_preview_run_id_fkey"
  FOREIGN KEY ("preview_run_id") REFERENCES "school_year_lifecycle_preview_run"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_preview_candidate_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "school_year_lifecycle_candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school_year_lifecycle_commit_attempt"
  ADD CONSTRAINT "school_year_lifecycle_commit_attempt_lifecycle_run_id_fkey"
  FOREIGN KEY ("lifecycle_run_id") REFERENCES "school_year_lifecycle_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_commit_attempt_preview_run_id_fkey"
  FOREIGN KEY ("preview_run_id") REFERENCES "school_year_lifecycle_preview_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_commit_attempt_campus_id_fkey"
  FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_commit_attempt_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "school_year_lifecycle_commit_row_result"
  ADD CONSTRAINT "school_year_lifecycle_commit_row_result_commit_attempt_id_fkey"
  FOREIGN KEY ("commit_attempt_id") REFERENCES "school_year_lifecycle_commit_attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_commit_row_result_lifecycle_candidate_id_fkey"
  FOREIGN KEY ("lifecycle_candidate_id") REFERENCES "school_year_lifecycle_candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "school_year_lifecycle_commit_row_result_campus_id_fkey"
  FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
