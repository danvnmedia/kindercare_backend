-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateTable
CREATE TABLE "parent_relationship" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "parent_relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "class_role_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "student" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" CITEXT,
    "phone_number" TEXT,
    "address" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "nickname" TEXT,
    "gender" TEXT,
    "enrollment_date" TIMESTAMP(3),
    "is_on_track" BOOLEAN NOT NULL DEFAULT true,
    "class_id" UUID,
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
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "start_date" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "address" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "occupation" TEXT,
    "work_address" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "user_id" UUID,
    "spouse_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "parent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_parent" (
    "student_id" UUID NOT NULL,
    "parent_id" UUID NOT NULL,
    "parent_relationship_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "student_parent_pkey" PRIMARY KEY ("student_id","parent_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
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
CREATE TABLE "class_homeroom_teacher" (
    "class_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "class_role_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "class_homeroom_teacher_pkey" PRIMARY KEY ("class_id","teacher_id")
);

-- CreateTable
CREATE TABLE "class_subject_teacher" (
    "class_id" UUID NOT NULL,
    "teacher_id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "class_subject_teacher_pkey" PRIMARY KEY ("class_id","teacher_id","subject_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_relationship_name_key" ON "parent_relationship"("name");

-- CreateIndex
CREATE UNIQUE INDEX "class_role_name_key" ON "class_role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_clerk_uid_key" ON "user"("clerk_uid");

-- CreateIndex
CREATE UNIQUE INDEX "role_name_key" ON "role"("name");

-- CreateIndex
CREATE INDEX "student_email_idx" ON "student"("email");

-- CreateIndex
CREATE INDEX "student_phone_number_idx" ON "student"("phone_number");

-- CreateIndex
CREATE INDEX "student_class_id_idx" ON "student"("class_id");

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
CREATE INDEX "teacher_is_archived_idx" ON "teacher"("is_archived");

-- CreateIndex
CREATE UNIQUE INDEX "parent_email_key" ON "parent"("email");

-- CreateIndex
CREATE UNIQUE INDEX "parent_phone_number_key" ON "parent"("phone_number");

-- CreateIndex
CREATE UNIQUE INDEX "parent_user_id_key" ON "parent"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "parent_spouse_id_key" ON "parent"("spouse_id");

-- CreateIndex
CREATE INDEX "parent_email_idx" ON "parent"("email");

-- CreateIndex
CREATE INDEX "parent_phone_number_idx" ON "parent"("phone_number");

-- CreateIndex
CREATE INDEX "parent_spouse_id_idx" ON "parent"("spouse_id");

-- CreateIndex
CREATE INDEX "parent_is_archived_idx" ON "parent"("is_archived");

-- CreateIndex
CREATE INDEX "student_parent_parent_id_idx" ON "student_parent"("parent_id");

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
CREATE INDEX "class_homeroom_teacher_teacher_id_idx" ON "class_homeroom_teacher"("teacher_id");

-- CreateIndex
CREATE INDEX "class_subject_teacher_teacher_id_idx" ON "class_subject_teacher"("teacher_id");

-- CreateIndex
CREATE INDEX "class_subject_teacher_subject_id_idx" ON "class_subject_teacher"("subject_id");

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher" ADD CONSTRAINT "teacher_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent" ADD CONSTRAINT "parent_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent" ADD CONSTRAINT "parent_spouse_id_fkey" FOREIGN KEY ("spouse_id") REFERENCES "parent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parent" ADD CONSTRAINT "student_parent_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parent" ADD CONSTRAINT "student_parent_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_parent" ADD CONSTRAINT "student_parent_parent_relationship_id_fkey" FOREIGN KEY ("parent_relationship_id") REFERENCES "parent_relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_grade_level_id_fkey" FOREIGN KEY ("grade_level_id") REFERENCES "grade_level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_homeroom_teacher" ADD CONSTRAINT "class_homeroom_teacher_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_homeroom_teacher" ADD CONSTRAINT "class_homeroom_teacher_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_homeroom_teacher" ADD CONSTRAINT "class_homeroom_teacher_class_role_id_fkey" FOREIGN KEY ("class_role_id") REFERENCES "class_role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_teacher" ADD CONSTRAINT "class_subject_teacher_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_teacher" ADD CONSTRAINT "class_subject_teacher_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_subject_teacher" ADD CONSTRAINT "class_subject_teacher_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
