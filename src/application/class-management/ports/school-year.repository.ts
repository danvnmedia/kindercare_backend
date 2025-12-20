/**
 * SchoolYear Repository Port (Interface)
 * Defines the contract for school year data access
 * Implementation will be provided by infrastructure layer
 */

import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

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
   * Find all non-archived school years
   */
  abstract findNonArchived(): Promise<SchoolYear[]>;

  /**
   * Find all school years with filtering, sorting, pagination
   */
  abstract findAll(
    params: StandardRequest,
  ): Promise<PaginatedResult<SchoolYear>>;

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
   * Archive a school year
   */
  abstract archive(id: string): Promise<SchoolYear>;

  /**
   * Unarchive a school year
   */
  abstract unarchive(id: string): Promise<SchoolYear>;
}
