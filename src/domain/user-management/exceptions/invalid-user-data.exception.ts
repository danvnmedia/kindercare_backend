/**
 * Exception thrown when user data is invalid
 * Domain-level exception (framework-agnostic)
 */
export class InvalidUserDataException extends Error {
  constructor(message: string) {
    super(`Invalid user data: ${message}`);
    this.name = 'InvalidUserDataException';
  }
}
