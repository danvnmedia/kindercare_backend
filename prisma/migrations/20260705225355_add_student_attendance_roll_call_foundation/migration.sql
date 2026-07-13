ALTER TABLE "student_attendance_summary"
  ADD COLUMN "absence_request_id" UUID;

CREATE INDEX "student_attendance_summary_absence_request_id_idx"
  ON "student_attendance_summary"("absence_request_id");

ALTER TABLE "student_attendance_summary"
  ADD CONSTRAINT "student_attendance_summary_absence_request_id_fkey"
  FOREIGN KEY ("absence_request_id") REFERENCES "absence_request"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "student_attendance_change_log" (
    "id" UUID NOT NULL,
    "attendance_summary_id" UUID NOT NULL,
    "change_type" VARCHAR(50) NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "actor_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_attendance_change_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_attendance_change_log_attendance_summary_id_idx"
  ON "student_attendance_change_log"("attendance_summary_id");

CREATE INDEX "student_attendance_change_log_actor_id_idx"
  ON "student_attendance_change_log"("actor_id");

CREATE INDEX "student_attendance_change_log_change_type_idx"
  ON "student_attendance_change_log"("change_type");

CREATE INDEX "student_attendance_change_log_created_at_idx"
  ON "student_attendance_change_log"("created_at");

ALTER TABLE "student_attendance_change_log"
  ADD CONSTRAINT "student_attendance_change_log_attendance_summary_id_fkey"
  FOREIGN KEY ("attendance_summary_id") REFERENCES "student_attendance_summary"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_attendance_change_log"
  ADD CONSTRAINT "student_attendance_change_log_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
