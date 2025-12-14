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
   * Find class by name within a school year and grade level
   */
  abstract findByNameInContext(
    name: string,
    schoolYearId: string,
    gradeLevelId: string,
  ): Promise<Class | null>;

  /**
   * Find classes by grade level
   */
  abstract findByGradeLevelId(gradeLevelId: string): Promise<Class[]>;

  /**
   * Find classes by school year
   */
  abstract findBySchoolYearId(schoolYearId: string): Promise<Class[]>;

  /**
   * Find multiple classes by IDs
   */
  abstract findByIds(ids: string[]): Promise<Class[]>;

  /**
   * Find all classes with filtering, sorting, pagination using StandardRequest
   */
  abstract findAll(params: StandardRequest): Promise<PaginatedResult<Class>>;

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
