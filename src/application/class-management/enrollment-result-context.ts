import { Class } from "@/domain/class-management/entities/class.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import {
  EnrollmentReadinessContext,
  EnrollmentReadinessEnrollmentContext,
  EnrollmentReadinessParentContext,
} from "./enrollment-readiness.types";

export function buildEnrollmentResultContext(
  requestedDate: Date,
  targetClass: Class,
  options: {
    schoolYearEnrollment?: SchoolYearEnrollment | null;
    activeEnrollment?: Enrollment | null;
    conflictingEnrollment?: Enrollment | null;
  } = {},
): EnrollmentReadinessContext {
  return {
    requestedDate,
    targetClass: { id: targetClass.id, name: targetClass.name },
    targetGradeLevel: targetClass.gradeLevel
      ? {
          id: targetClass.gradeLevel.id,
          name: targetClass.gradeLevel.name,
          order: targetClass.gradeLevel.order,
        }
      : { id: targetClass.gradeLevelId, name: "", order: undefined },
    targetSchoolYear: targetClass.schoolYear
      ? {
          id: targetClass.schoolYear.id,
          name: targetClass.schoolYear.name,
          startDate: targetClass.schoolYear.startDate,
          endDate: targetClass.schoolYear.endDate,
        }
      : null,
    schoolYearEnrollment:
      options.schoolYearEnrollment === undefined
        ? undefined
        : options.schoolYearEnrollment
          ? toParentContext(options.schoolYearEnrollment)
          : null,
    activeEnrollment:
      options.activeEnrollment === undefined
        ? undefined
        : options.activeEnrollment
          ? toEnrollmentContext(options.activeEnrollment)
          : null,
    conflictingEnrollment:
      options.conflictingEnrollment === undefined
        ? undefined
        : options.conflictingEnrollment
          ? toEnrollmentContext(options.conflictingEnrollment)
          : null,
  };
}

export function toParentContext(
  parent: SchoolYearEnrollment,
): EnrollmentReadinessParentContext {
  return {
    id: parent.id,
    gradeLevelId: parent.gradeLevelId,
    gradeLevel: parent.gradeLevel
      ? {
          id: parent.gradeLevel.id,
          name: parent.gradeLevel.name,
          order: parent.gradeLevel.order,
        }
      : null,
    enrollmentDate: parent.enrollmentDate,
    exitDate: parent.exitDate,
    exitReason: parent.exitReason,
  };
}

export function toEnrollmentContext(
  enrollment: Enrollment,
): EnrollmentReadinessEnrollmentContext {
  return {
    id: enrollment.id,
    classId: enrollment.classId,
    class: enrollment.class
      ? { id: enrollment.class.id, name: enrollment.class.name }
      : null,
    enrollmentDate: enrollment.enrollmentDate,
    endDate: enrollment.endDate,
    exitReason: enrollment.exitReason,
  };
}
