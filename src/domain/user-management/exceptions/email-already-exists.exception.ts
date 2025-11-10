/**
 * Exception thrown when email already exists
 * Domain-level exception (framework-agnostic)
 */
export class EmailAlreadyExistsException extends Error {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.name = 'EmailAlreadyExistsException';
  }
}
