/**
 * Exception thrown when a student is not found
 * Domain-level exception (framework-agnostic)
 */
export class StudentNotFoundException extends Error {
  constructor(identifier: string) {
    super(`Student with ID ${identifier} not found`);
    this.name = "StudentNotFoundException";
  }
}
