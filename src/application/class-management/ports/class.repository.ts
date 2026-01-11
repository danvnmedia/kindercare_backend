/**
 * Class Repository Port (Interface)
 * Defines the contract for class data access
 * Implementation will be provided by infrastructure layer
 */

import { Class } from "@/domain/class-management/entities/class.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class ClassRepository {
  /**
   * Find class by ID
   */
  abstract findById(id: string): Promise<Class | null>;

  /**
   * Find class by name within a campus, school year, and grade level
   * Used for uniqueness check: (campus_id, school_year_id, grade_level_id, name)
   */
  abstract findByNameInContextAndCampus(
    name: string,
    campusId: string,
    schoolYearId: string,
    gradeLevelId: string,
  ): Promise<Class | null>;

  /**
   * Find classes by campus
   */
  abstract findByCampusId(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<Class>>;

  /**
   * Find classes by grade level (within a campus)
   */
  abstract findByGradeLevelId(
    gradeLevelId: string,
    campusId: string,
  ): Promise<Class[]>;

  /**
   * Find classes by school year (within a campus)
   */
  abstract findBySchoolYearId(
    schoolYearId: string,
    campusId: string,
  ): Promise<Class[]>;

  /**
   * Find multiple classes by IDs
   */
  abstract findByIds(ids: string[]): Promise<Class[]>;

  /**
   * Find all classes with filtering, sorting, pagination using StandardRequest
   * @param campusId - Campus ID to filter by
   * @param params - Standard request with pagination, filtering, sorting
   */
  abstract findAll(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<Class>>;

  /**
   * Save a new class
   */
  abstract save(classEntity: Class): Promise<Class>;

  /**
   * Update existing class
   */
  abstract update(classEntity: Class): Promise<Class>;

  /**
   * Delete class
   */
  abstract delete(id: string): Promise<void>;
}
