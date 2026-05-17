/**
 * Thrown when a SchoolYearEnrollment exit date violates a temporal invariant —
 * either before the parent's enrollment date or in the future. Use cases map
 * this to HTTP 400 (INVALID_EXIT_DATE).
 */
export class InvalidExitDateException extends Error {
  constructor(reason: string) {
    super(`Invalid exit date: ${reason}`);
    this.name = "InvalidExitDateException";
  }
}
