/**
 * Exception thrown when a role is not found
 * Domain-level exception (framework-agnostic)
 */
export class RoleNotFoundException extends Error {
  constructor(identifier: number | string) {
    super(`Role with ID ${identifier} not found`);
    this.name = 'RoleNotFoundException';
  }
}
