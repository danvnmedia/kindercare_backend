/**
 * Student Code Generator Port
 *
 * Provides student code generation abstraction for use cases.
 * Follows Clean Architecture - application layer defines the contract,
 * infrastructure layer provides the implementation.
 *
 * Student codes are unique per campus - each campus maintains its own sequence.
 */
export abstract class StudentCodeGeneratorPort {
  /**
   * Generates next student code in format YYYY-XXXXXX for the given campus
   * @param campusId - The campus ID for which to generate the code
   * @returns Student code string (e.g., "2025-000001")
   * @throws Error if sequence exhausted for the year
   */
  abstract generateNextCode(campusId: string): Promise<string>;
}
