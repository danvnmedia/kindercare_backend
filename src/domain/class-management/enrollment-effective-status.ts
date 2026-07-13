import { EnrollmentEffectiveStatus } from "./enums/enrollment-effective-status.enum";

export interface EnrollmentEffectiveStatusInput {
  enrollmentDate: Date;
  endDate: Date | null;
  cancelledAt: Date | null;
  referenceDate: Date;
}

export function toUtcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Derives the calendar-effective enrollment state without persisting a value
 * that changes as the UTC date advances. End dates are inclusive.
 */
export function deriveEnrollmentEffectiveStatus(
  input: EnrollmentEffectiveStatusInput,
): EnrollmentEffectiveStatus {
  if (input.cancelledAt !== null) {
    return EnrollmentEffectiveStatus.CANCELLED;
  }

  const referenceDay = toUtcDateOnly(input.referenceDate).getTime();
  const enrollmentDay = toUtcDateOnly(input.enrollmentDate).getTime();

  if (enrollmentDay > referenceDay) {
    return EnrollmentEffectiveStatus.UPCOMING;
  }

  if (
    input.endDate !== null &&
    toUtcDateOnly(input.endDate).getTime() < referenceDay
  ) {
    return EnrollmentEffectiveStatus.CLOSED;
  }

  return EnrollmentEffectiveStatus.ACTIVE;
}
