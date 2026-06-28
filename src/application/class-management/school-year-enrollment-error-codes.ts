/**
 * Error codes for SchoolYearEnrollment use cases (parent enrollment lifecycle).
 *
 * See specs/school-year-enrollment-model "Error codes (additions)" section.
 * Includes codes consumed by sibling tasks (mgst67, ita7vb, 0gb7qi) so they
 * can be imported without later churn.
 */
export const SchoolYearEnrollmentErrorCode = {
  /** SchoolYear missing or not in caller's campus (404, cross-campus hidden). */
  SCHOOL_YEAR_NOT_FOUND: "SCHOOL_YEAR_NOT_FOUND",
  /** GradeLevel missing or not in caller's campus (404, cross-campus hidden). */
  GRADE_LEVEL_NOT_FOUND: "GRADE_LEVEL_NOT_FOUND",
  /** enrollmentDate outside SchoolYear.{startDate, endDate} (400). */
  REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR: "REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR",
  /** Second open parent attempted for the same (studentId, schoolYearId) (409). */
  SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS:
    "SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS",
  /** Class enrollment attempted with no open parent for the school year (409). */
  NO_SCHOOL_YEAR_ENROLLMENT: "NO_SCHOOL_YEAR_ENROLLMENT",
  /** class.gradeLevelId !== parent.gradeLevelId (409). */
  GRADE_LEVEL_MISMATCH: "GRADE_LEVEL_MISMATCH",
  /** Withdraw attempted on an already-closed parent (409). */
  PARENT_ALREADY_CLOSED: "PARENT_ALREADY_CLOSED",
  /** exitDate < parent.enrollmentDate, or exitDate > today (400). */
  INVALID_EXIT_DATE: "INVALID_EXIT_DATE",
} as const;

export type SchoolYearEnrollmentErrorCode =
  (typeof SchoolYearEnrollmentErrorCode)[keyof typeof SchoolYearEnrollmentErrorCode];
