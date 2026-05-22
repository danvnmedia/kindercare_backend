/**
 * Thrown when an enrollment end date violates a temporal invariant — either
 * before the enrollment's start date or in the future. Use cases map this to
 * HTTP 400 (INVALID_END_DATE).
 */
export class InvalidEndDateException extends Error {
  constructor(reason: string) {
    super(`Invalid end date: ${reason}`);
    this.name = "InvalidEndDateException";
  }
}
