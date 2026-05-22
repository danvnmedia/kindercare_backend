/**
 * Staff Code Generator Port
 *
 * Provides staff code generation abstraction for use cases.
 * Follows Clean Architecture - application layer defines the contract,
 * infrastructure layer provides the implementation.
 *
 * Staff codes are unique per campus - each campus maintains its own sequence.
 * Format: `ST-YYYY-XXXXXX` (e.g., `ST-2025-000001`).
 */
export abstract class StaffCodeGeneratorPort {
  /**
   * Generates next staff code in format `ST-YYYY-XXXXXX` for the given campus.
   *
   * @param campusId - The campus ID for which to generate the code.
   * @returns Staff code string (e.g., `ST-2025-000001`).
   * @throws ConflictException if sequence exhausted for the year.
   */
  abstract generateNextCode(campusId: string): Promise<string>;
}
