/**
 * SchoolYear Repository Port (Interface)
 * Defines the contract for school year data access
 * Implementation will be provided by infrastructure layer
 */

import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";

export abstract class SchoolYearRepository {
  /**
   * Find school year by ID
   */
  abstract findById(id: string): Promise<SchoolYear | null>;

  /**
   * Find school year by name
   */
  abstract findByName(name: string): Promise<SchoolYear | null>;

  /**
   * Find the currently active school year
   */
  abstract findActive(): Promise<SchoolYear | null>;

  /**
   * Find all school years
   */
  abstract findAll(): Promise<SchoolYear[]>;

  /**
   * Save a new school year
   */
  abstract save(schoolYear: SchoolYear): Promise<SchoolYear>;

  /**
   * Update existing school year
   */
  abstract update(schoolYear: SchoolYear): Promise<SchoolYear>;

  /**
   * Delete school year
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Set a school year as active (and deactivate others)
   */
  abstract setActive(id: string): Promise<SchoolYear>;
}
