CREATE TABLE "absence_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campus_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "requester_guardian_id" UUID NOT NULL,
    "requester_user_id" UUID,
    "absence_type" VARCHAR(20) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "description" VARCHAR(1000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "review_note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "absence_request_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "absence_request_type_check" CHECK ("absence_type" IN ('FULL_DAY', 'PARTIAL_DAY')),
    CONSTRAINT "absence_request_status_check" CHECK ("status" IN ('PENDING', 'APPROVED', 'DENIED')),
    CONSTRAINT "absence_request_date_range_check" CHECK ("end_date" >= "start_date"),
    CONSTRAINT "absence_request_description_non_blank_check" CHECK (length(btrim("description")) > 0),
    CONSTRAINT "absence_request_review_note_non_blank_check" CHECK ("review_note" IS NULL OR length(btrim("review_note")) > 0),
    CONSTRAINT "absence_request_full_day_time_check" CHECK (
        ("absence_type" = 'FULL_DAY' AND "start_minute" IS NULL AND "end_minute" IS NULL)
        OR "absence_type" <> 'FULL_DAY'
    ),
    CONSTRAINT "absence_request_partial_day_time_check" CHECK (
        ("absence_type" = 'PARTIAL_DAY'
            AND "start_date" = "end_date"
            AND "start_minute" IS NOT NULL
            AND "end_minute" IS NOT NULL
            AND "start_minute" >= 0
            AND "start_minute" < 1440
            AND "end_minute" > "start_minute"
            AND "end_minute" <= 1440)
        OR "absence_type" <> 'PARTIAL_DAY'
    ),
    CONSTRAINT "absence_request_review_state_check" CHECK (
        ("status" = 'PENDING' AND "reviewed_by_id" IS NULL AND "reviewed_at" IS NULL)
        OR ("status" IN ('APPROVED', 'DENIED') AND "reviewed_by_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)
    )
);

CREATE INDEX "absence_request_campus_status_start_idx" ON "absence_request"("campus_id", "status", "start_date");
CREATE INDEX "absence_request_student_date_idx" ON "absence_request"("campus_id", "student_id", "start_date", "end_date");
CREATE INDEX "absence_request_guardian_history_idx" ON "absence_request"("requester_guardian_id", "created_at");
CREATE INDEX "absence_request_reviewed_by_id_idx" ON "absence_request"("reviewed_by_id");

ALTER TABLE "absence_request" ADD CONSTRAINT "absence_request_campus_id_fkey" FOREIGN KEY ("campus_id") REFERENCES "campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "absence_request" ADD CONSTRAINT "absence_request_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "absence_request" ADD CONSTRAINT "absence_request_requester_guardian_id_fkey" FOREIGN KEY ("requester_guardian_id") REFERENCES "guardian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "absence_request" ADD CONSTRAINT "absence_request_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "absence_request" ADD CONSTRAINT "absence_request_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
