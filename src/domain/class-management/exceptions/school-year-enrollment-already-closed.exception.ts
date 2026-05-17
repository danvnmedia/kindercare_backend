/**
 * Thrown when withdraw() is called on a SchoolYearEnrollment whose period has
 * already been closed (exitDate is non-null). Use cases map this to HTTP 409
 * (PARENT_ALREADY_CLOSED).
 */
export class SchoolYearEnrollmentAlreadyClosedException extends Error {
  constructor(schoolYearEnrollmentId: string) {
    super(`School year enrollment ${schoolYearEnrollmentId} is already closed`);
    this.name = "SchoolYearEnrollmentAlreadyClosedException";
  }
}
