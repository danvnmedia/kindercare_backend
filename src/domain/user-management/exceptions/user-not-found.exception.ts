/**
 * Exception thrown when a user is not found
 * Domain-level exception (framework-agnostic)
 */
export class UserNotFoundException extends Error {
  constructor(identifier: number | string) {
    super(`User with ID ${identifier} not found`);
    this.name = 'UserNotFoundException';
  }
}
