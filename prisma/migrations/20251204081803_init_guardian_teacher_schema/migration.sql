-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateTable
CREATE TABLE "guardian_relationship" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "guardian_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "clerk_uid" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "student" (
    "id" UUID NOT NULL,
    "student_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" CITEXT,
    "phone_number" TEXT,
    "address" TEXT,
    "date_of_birth" DATE,
    "nickname" TEXT,
    "gender" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "address" TEXT,
    "date_of_birth" DATE,
    "gender" TEXT,
    "start_date" DATE,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "address" TEXT,
    "date_of_birth" DATE,
    "gender" TEXT,
    "occupation" TEXT,
    "work_address" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "spouse_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_student" (
    "student_id" UUID NOT NULL,
    "guardian_id" UUID NOT NULL,
    "guardian_relationship_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardian_student_pkey" PRIMARY KEY ("student_id","guardian_id")
);

-- CreateTable
CREATE TABLE "grade_level" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grade_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "grade_level_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_teacher" (
    "class_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "class_teacher_pkey" PRIMARY KEY ("class_id","teacher_id","subject_id")
);

-- CreateTable
CREATE TABLE "enrollment" (
    "id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "enrollment_date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_attendance" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "checkin_at" TIMESTAMPTZ(6),
    "checkout_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "reason" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publish_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_history" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "audience" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "status" TEXT NOT NULL,
    "publish_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "post_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_history_status" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "post_history_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_audience" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "post_id" UUID NOT NULL,
    "class_id" UUID,
    "student_id" UUID,

    CONSTRAINT "post_audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "comment" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_relationship_name_key" ON "guardian_relationship"("name");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_clerk_uid_key" ON "user"("clerk_uid");

-- CreateIndex
CREATE INDEX "user_clerk_uid_idx" ON "user"("clerk_uid");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_student_code_key" ON "student"("student_code");

-- CreateIndex
CREATE INDEX "student_email_idx" ON "student"("email");

-- CreateIndex
CREATE INDEX "student_phone_number_idx" ON "student"("phone_number");

-- CreateIndex
CREATE INDEX "student_is_archived_idx" ON "student"("is_archived");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_email_key" ON "teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_phone_number_key" ON "teacher"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_user_id_key" ON "teacher"("user_id");

-- CreateIndex
CREATE INDEX "teacher_email_idx" ON "teacher"("email");

-- CreateIndex
CREATE INDEX "teacher_phone_number_idx" ON "teacher"("phone_number");

-- CreateIndex
CREATE INDEX "teacher_user_id_idx" ON "teacher"("user_id");

-- CreateIndex
CREATE INDEX "teacher_is_archived_idx" ON "teacher"("is_archived");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_email_key" ON "guardian"("email");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_phone_number_key" ON "guardian"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_user_id_key" ON "guardian"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_spouse_id_key" ON "guardian"("spouse_id");

-- CreateIndex
CREATE INDEX "guardian_email_idx" ON "guardian"("email");

-- CreateIndex
CREATE INDEX "guardian_phone_number_idx" ON "guardian"("phone_number");

-- CreateIndex
CREATE INDEX "guardian_user_id_idx" ON "guardian"("user_id");

-- CreateIndex
CREATE INDEX "guardian_spouse_id_idx" ON "guardian"("spouse_id");

-- CreateIndex
CREATE INDEX "guardian_is_archived_idx" ON "guardian"("is_archived");

-- CreateIndex
CREATE INDEX "guardian_student_guardian_id_idx" ON "guardian_student"("guardian_id");

-- CreateIndex
CREATE INDEX "guardian_student_guardian_relationship_id_idx" ON "guardian_student"("guardian_relationship_id");

-- CreateIndex
CREATE UNIQUE INDEX "grade_level_name_key" ON "grade_level"("name");

-- CreateIndex
CREATE UNIQUE INDEX "grade_level_order_key" ON "grade_level"("order");

-- CreateIndex
CREATE UNIQUE INDEX "subject_name_key" ON "subject"("name");

-- CreateIndex
CREATE INDEX "class_grade_level_id_idx" ON "class"("grade_level_id");

-- CreateIndex
CREATE UNIQUE INDEX "class_grade_level_id_name_key" ON "class"("grade_level_id", "name");

-- CreateIndex
CREATE INDEX "class_teacher_teacher_id_idx" ON "class_teacher"("teacher_id");

-- CreateIndex
CREATE INDEX "class_teacher_subject_id_idx" ON "class_teacher"("subject_id");

-- CreateIndex
CREATE INDEX "enrollment_class_id_idx" ON "enrollment"("class_id");

-- CreateIndex
CREATE INDEX "enrollment_student_id_idx" ON "enrollment"("student_id");

-- CreateIndex
CREATE INDEX "enrollment_enrollment_date_idx" ON "enrollment"("enrollment_date");

-- CreateIndex
CREATE UNIQUE INDEX "enrollment_student_id_class_id_enrollment_date_key" ON "enrollment"("student_id", "class_id", "enrollment_date");

-- CreateIndex
CREATE INDEX "student_attendance_class_id_idx" ON "student_attendance"("class_id");

-- CreateIndex
CREATE INDEX "student_attendance_date_idx" ON "student_attendance"("date");

-- CreateIndex
CREATE INDEX "student_attendance_status_idx" ON "student_attendance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendance_student_id_date_key" ON "student_attendance"("student_id", "date");

-- CreateIndex
CREATE INDEX "post_author_id_idx" ON "post"("author_id");

-- CreateIndex
CREATE INDEX "post_status_idx" ON "post"("status");

-- CreateIndex
CREATE INDEX "post_type_idx" ON "post"("type");

-- CreateIndex
CREATE INDEX "post_publish_at_idx" ON "post"("publish_at");

-- CreateIndex
CREATE INDEX "post_created_at_idx" ON "post"("created_at");

-- CreateIndex
CREATE INDEX "post_history_post_id_idx" ON "post_history"("post_id");

-- CreateIndex
CREATE INDEX "post_history_author_id_idx" ON "post_history"("author_id");

-- CreateIndex
CREATE INDEX "post_history_created_at_idx" ON "post_history"("created_at");

-- CreateIndex
CREATE INDEX "post_history_status_post_id_idx" ON "post_history_status"("post_id");

-- CreateIndex
CREATE INDEX "post_history_status_user_id_idx" ON "post_history_status"("user_id");

-- CreateIndex
CREATE INDEX "post_history_status_status_idx" ON "post_history_status"("status");

-- CreateIndex
CREATE INDEX "post_history_status_created_at_idx" ON "post_history_status"("created_at");

-- CreateIndex
CREATE INDEX "post_audience_post_id_idx" ON "post_audience"("post_id");

-- CreateIndex
CREATE INDEX "post_audience_class_id_idx" ON "post_audience"("class_id");

-- CreateIndex
CREATE INDEX "post_audience_student_id_idx" ON "post_audience"("student_id");

-- CreateIndex
CREATE INDEX "post_audience_type_idx" ON "post_audience"("type");

-- CreateIndex
CREATE INDEX "file_uploaded_by_idx" ON "file"("uploaded_by");

-- CreateIndex
CREATE INDEX "file_status_idx" ON "file"("status");

-- CreateIndex
CREATE INDEX "file_created_at_idx" ON "file"("created_at");

-- CreateIndex
CREATE INDEX "attachment_post_id_idx" ON "attachment"("post_id");

-- CreateIndex
CREATE INDEX "attachment_file_id_idx" ON "attachment"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_post_id_order_key" ON "attachment"("post_id", "order");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher" ADD CONSTRAINT "teacher_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_spouse_id_fkey" FOREIGN KEY ("spouse_id") REFERENCES "guardian"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardian"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_student" ADD CONSTRAINT "guardian_student_guardian_relationship_id_fkey" FOREIGN KEY ("guardian_relationship_id") REFERENCES "guardian_relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_teacher" ADD CONSTRAINT "class_teacher_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_attendance" ADD CONSTRAINT "student_attendance_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_history" ADD CONSTRAINT "post_history_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_history" ADD CONSTRAINT "post_history_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_history_status" ADD CONSTRAINT "post_history_status_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_history_status" ADD CONSTRAINT "post_history_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_audience" ADD CONSTRAINT "post_audience_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file" ADD CONSTRAINT "file_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
