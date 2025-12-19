/**
 * Student Code Generator Port
 *
 * Provides student code generation abstraction for use cases.
 * Follows Clean Architecture - application layer defines the contract,
 * infrastructure layer provides the implementation.
 */
export abstract class StudentCodeGeneratorPort {
  /**
   * Generates next student code in format YYYY-XXXXXX
   * @returns Student code string (e.g., "2025-000001")
   * @throws Error if sequence exhausted for the year
   */
  abstract generateNextCode(): Promise<string>;
}
