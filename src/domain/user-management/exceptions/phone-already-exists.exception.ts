/**
 * Exception thrown when phone number already exists
 * Domain-level exception (framework-agnostic)
 */
export class PhoneAlreadyExistsException extends Error {
  constructor(phoneNumber: string) {
    super(`User with phone number ${phoneNumber} already exists`);
    this.name = 'PhoneAlreadyExistsException';
  }
}
