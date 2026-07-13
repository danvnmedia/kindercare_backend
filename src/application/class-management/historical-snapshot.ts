import { Class as ClassEntity } from "@/domain/class-management/entities/class.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { Student } from "@/domain/user-management/entities/student.entity";

export function buildEnrollmentSnapshot(
  student: Student,
  classEntity: ClassEntity,
  capturedAt: Date = new Date(),
) {
  const gradeLevel = classEntity.gradeLevel;
  const schoolYear = classEntity.schoolYear;

  return {
    snapshotStudentFullName: student.fullName,
    snapshotStudentCode: student.studentCode,
    snapshotStudentNickname: student.nickname,
    snapshotClassName: classEntity.name,
    snapshotGradeLevelName: gradeLevel?.name ?? null,
    snapshotGradeLevelOrder: gradeLevel?.order ?? null,
    snapshotSchoolYearName: schoolYear?.name ?? null,
    snapshotSchoolYearStartDate: schoolYear?.startDate ?? null,
    snapshotSchoolYearEndDate: schoolYear?.endDate ?? null,
    snapshotCapturedAt: capturedAt,
  };
}

export function buildSchoolYearEnrollmentSnapshot(
  student: Student,
  gradeLevel: GradeLevel,
  schoolYear: SchoolYear,
  capturedAt: Date = new Date(),
) {
  return {
    snapshotStudentFullName: student.fullName,
    snapshotStudentCode: student.studentCode,
    snapshotStudentNickname: student.nickname,
    snapshotGradeLevelName: gradeLevel.name,
    snapshotGradeLevelOrder: gradeLevel.order,
    snapshotSchoolYearName: schoolYear.name,
    snapshotSchoolYearStartDate: schoolYear.startDate,
    snapshotSchoolYearEndDate: schoolYear.endDate,
    snapshotCapturedAt: capturedAt,
  };
}
