/**
 * GradeLevel Repository Port (Interface)
 * Defines the contract for grade level data access
 * Implementation will be provided by infrastructure layer
 */

import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class GradeLevelRepository {
  /**
   * Find grade level by ID
   */
  abstract findById(id: string): Promise<GradeLevel | null>;

  /**
   * Find grade level by name within a campus
   */
  abstract findByNameAndCampus(
    name: string,
    campusId: string,
  ): Promise<GradeLevel | null>;

  /**
   * Find grade level by order within a campus
   */
  abstract findByOrderAndCampus(
    order: number,
    campusId: string,
  ): Promise<GradeLevel | null>;

  /**
   * Find all grade levels for a campus, ordered by order field
   */
  abstract findAll(campusId: string): Promise<GradeLevel[]>;

  /**
   * Find all non-archived grade levels for a campus
   */
  abstract findNonArchived(campusId: string): Promise<GradeLevel[]>;

  /**
   * Find all grade levels for a campus with pagination, filtering, and sorting
   */
  abstract findAllPaginated(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<GradeLevel>>;

  /**
   * Find all grade levels for a campus with their associated classes, with filtering, sorting, pagination
   */
  abstract findAllWithClasses(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<GradeLevel>>;

  /**
   * Find all non-archived grade levels for a campus with their associated classes
   */
  abstract findNonArchivedWithClasses(campusId: string): Promise<GradeLevel[]>;

  /**
   * Save a new grade level
   */
  abstract save(gradeLevel: GradeLevel): Promise<GradeLevel>;

  /**
   * Update existing grade level
   */
  abstract update(gradeLevel: GradeLevel): Promise<GradeLevel>;

  /**
   * Delete grade level
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Archive a grade level
   */
  abstract archive(id: string): Promise<GradeLevel>;

  /**
   * Unarchive a grade level
   */
  abstract unarchive(id: string): Promise<GradeLevel>;

  /**
   * Get the maximum order value among all grade levels for a campus
   * Returns 0 if no grade levels exist
   */
  abstract getMaxOrder(campusId: string): Promise<number>;

  /**
   * Reorder grade levels within a campus based on the provided array of IDs
   * The order field will be set based on the array index (index 0 = order 1, etc.)
   * @param campusId - Campus to scope the reorder operation to
   * @param ids - Array of grade level IDs in the desired order
   * @returns Updated grade levels sorted by new order
   */
  abstract reorder(campusId: string, ids: string[]): Promise<GradeLevel[]>;
}
