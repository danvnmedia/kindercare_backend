export enum EnrollmentCancellationReason {
  FAMILY_REQUEST = "FAMILY_REQUEST",
  CHANGED_SCHOOL = "CHANGED_SCHOOL",
  DUPLICATE_REGISTRATION = "DUPLICATE_REGISTRATION",
  DATA_ENTRY_ERROR = "DATA_ENTRY_ERROR",
  OTHER = "OTHER",
}

const ENROLLMENT_CANCELLATION_REASON_VALUES = new Set<string>(
  Object.values(EnrollmentCancellationReason),
);

export function isEnrollmentCancellationReason(
  value: unknown,
): value is EnrollmentCancellationReason {
  return (
    typeof value === "string" &&
    ENROLLMENT_CANCELLATION_REASON_VALUES.has(value)
  );
}
