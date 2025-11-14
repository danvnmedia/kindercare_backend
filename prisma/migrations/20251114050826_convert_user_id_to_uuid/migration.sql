/*
  Warnings:

  - The `userId` column on the `Student` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `StudentParent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_RoleToUser` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `parentUserId` on the `StudentParent` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `TeacherProfile` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `B` on the `_RoleToUser` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."Student" DROP CONSTRAINT "Student_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."StudentParent" DROP CONSTRAINT "StudentParent_parentUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TeacherProfile" DROP CONSTRAINT "TeacherProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."_RoleToUser" DROP CONSTRAINT "_RoleToUser_B_fkey";

-- AlterTable
ALTER TABLE "Student" DROP COLUMN "userId",
ADD COLUMN     "userId" UUID;

-- AlterTable
ALTER TABLE "StudentParent" DROP CONSTRAINT "StudentParent_pkey",
DROP COLUMN "parentUserId",
ADD COLUMN     "parentUserId" UUID NOT NULL,
ADD CONSTRAINT "StudentParent_pkey" PRIMARY KEY ("studentId", "parentUserId");

-- AlterTable
ALTER TABLE "TeacherProfile" DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "_RoleToUser" DROP CONSTRAINT "_RoleToUser_AB_pkey",
DROP COLUMN "B",
ADD COLUMN     "B" UUID NOT NULL,
ADD CONSTRAINT "_RoleToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "Student_userId_key" ON "Student"("userId");

-- CreateIndex
CREATE INDEX "StudentParent_parentUserId_idx" ON "StudentParent"("parentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE INDEX "_RoleToUser_B_index" ON "_RoleToUser"("B");

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentParent" ADD CONSTRAINT "StudentParent_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RoleToUser" ADD CONSTRAINT "_RoleToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
