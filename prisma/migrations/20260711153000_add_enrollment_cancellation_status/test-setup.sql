CREATE TABLE "student" (
  "id" UUID PRIMARY KEY
);

CREATE TABLE "class" (
  "id" UUID PRIMARY KEY,
  "name" TEXT NOT NULL
);

CREATE TABLE "school_year_enrollment" (
  "id" UUID PRIMARY KEY,
  "student_id" UUID NOT NULL,
  "school_year_id" UUID NOT NULL,
  "enrollment_date" DATE NOT NULL,
  "exit_date" DATE,
  "exit_reason" TEXT,
  "note" TEXT
);

CREATE TABLE "enrollment" (
  "id" UUID PRIMARY KEY,
  "class_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "school_year_enrollment_id" UUID NOT NULL,
  "enrollment_date" DATE NOT NULL,
  "end_date" DATE,
  "exit_reason" TEXT,
  "note" TEXT,
  CONSTRAINT "enrollment_student_id_class_id_enrollment_date_key"
    UNIQUE (student_id, class_id, enrollment_date)
);

CREATE UNIQUE INDEX "idx_enrollment_one_active_per_student"
  ON "enrollment" (student_id)
  WHERE end_date IS NULL;

CREATE UNIQUE INDEX "idx_sye_one_open_per_year"
  ON "school_year_enrollment" (student_id, school_year_id)
  WHERE exit_date IS NULL;

CREATE VIEW "student_with_phase" AS
SELECT
  student_row.*,
  'WAITING'::TEXT AS phase,
  NULL::UUID AS current_class_id,
  NULL::TEXT AS current_class_name
FROM "student" student_row;
