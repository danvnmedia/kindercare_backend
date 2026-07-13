/**
 * Bulk-only enrollment error codes. See @doc/specs/bulk-enrollment#locked-decisions (D4).
 *
 * Single-row codes (STUDENT_ALREADY_ENROLLED, NO_ACTIVE_ENROLLMENT, TRANSFER_SAME_CLASS,
 * TRANSFER_SOURCE_MISMATCH, ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR) intentionally remain inline
 * in their use-cases by design.
 */
export const EnrollmentErrorCode = {
  BATCH_TOO_LARGE: "BATCH_TOO_LARGE",
  BATCH_EMPTY: "BATCH_EMPTY",
  DUPLICATE_STUDENT_IN_BATCH: "DUPLICATE_STUDENT_IN_BATCH",
  STUDENT_NOT_FOUND: "STUDENT_NOT_FOUND",
  STUDENT_NOT_IN_CAMPUS: "STUDENT_NOT_IN_CAMPUS",
  ENROLLMENT_ALREADY_EXISTS_ON_DATE: "ENROLLMENT_ALREADY_EXISTS_ON_DATE",
  ENROLLMENT_PERIOD_OVERLAP: "ENROLLMENT_PERIOD_OVERLAP",
} as const;

export type EnrollmentErrorCode =
  (typeof EnrollmentErrorCode)[keyof typeof EnrollmentErrorCode];
