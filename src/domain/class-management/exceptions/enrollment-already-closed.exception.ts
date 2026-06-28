/**
 * Thrown when withdraw() is called on an enrollment whose period has already
 * been closed (endDate is non-null). Use cases map this to HTTP 409
 * (ENROLLMENT_ALREADY_CLOSED).
 */
export class EnrollmentAlreadyClosedException extends Error {
  constructor(enrollmentId: string) {
    super(`Enrollment ${enrollmentId} is already closed`);
    this.name = "EnrollmentAlreadyClosedException";
  }
}
