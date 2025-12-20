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
   * Find grade level by name
   */
  abstract findByName(name: string): Promise<GradeLevel | null>;

  /**
   * Find grade level by order
   */
  abstract findByOrder(order: number): Promise<GradeLevel | null>;

  /**
   * Find all grade levels ordered by order field
   */
  abstract findAll(): Promise<GradeLevel[]>;

  /**
   * Find all non-archived grade levels
   */
  abstract findNonArchived(): Promise<GradeLevel[]>;

  /**
   * Find all grade levels with their associated classes, with filtering, sorting, pagination
   */
  abstract findAllWithClasses(
    params: StandardRequest,
  ): Promise<PaginatedResult<GradeLevel>>;

  /**
   * Find all non-archived grade levels with their associated classes
   */
  abstract findNonArchivedWithClasses(): Promise<GradeLevel[]>;

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
}
