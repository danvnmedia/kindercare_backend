import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { toUtcDateOnly } from "@/domain/class-management/enrollment-effective-status";
import { EnrollmentErrorCode } from "./enrollment-error-codes";

export interface EnrollmentPeriodOverlapDetails {
  code: typeof EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP;
  conflictingEnrollment: EnrollmentPeriodConflictContext | null;
}

export interface EnrollmentPeriodConflictContext {
  id: string;
  classId: string;
  className: string | null;
  enrollmentDate: Date;
  endDate: Date | null;
}

export function buildEnrollmentPeriodOverlapDetails(
  enrollment: Enrollment | null,
): EnrollmentPeriodOverlapDetails {
  return {
    code: EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP,
    conflictingEnrollment: enrollment
      ? {
          id: enrollment.id,
          classId: enrollment.classId,
          className: enrollment.class?.name ?? null,
          enrollmentDate: enrollment.enrollmentDate,
          endDate: enrollment.endDate,
        }
      : null,
  };
}

export class EnrollmentPeriodOverlapError extends Error {
  constructor(readonly conflictingEnrollment: Enrollment | null) {
    super(EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP);
    this.name = "EnrollmentPeriodOverlapError";
  }
}

export function previousUtcDate(date: Date): Date {
  const normalized = toUtcDateOnly(date);
  normalized.setUTCDate(normalized.getUTCDate() - 1);
  return normalized;
}

export function isEnrollmentPeriodOverlapPersistenceError(
  error: unknown,
): boolean {
  const candidate = error as {
    code?: string;
    message?: string;
    meta?: unknown;
  };
  const serialized = `${candidate.message ?? ""} ${JSON.stringify(candidate.meta ?? {})}`;
  const enrollmentP2002 =
    candidate.code === "P2002" &&
    (serialized.includes('"modelName":"Enrollment"') ||
      serialized.includes("enrollment_no_uncancelled_period_overlap") ||
      serialized.includes("idx_enrollment_unique_uncancelled_start"));
  return (
    enrollmentP2002 ||
    candidate.code === "23P01" ||
    serialized.includes("23P01") ||
    serialized.includes("enrollment_no_uncancelled_period_overlap") ||
    serialized.includes("idx_enrollment_unique_uncancelled_start")
  );
}
