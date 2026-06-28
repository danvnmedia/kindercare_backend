-- CreateTable
CREATE TABLE "student_code_sequence" (
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_code_sequence_pkey" PRIMARY KEY ("year")
);
