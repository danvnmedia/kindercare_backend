/**
 * GradeLevel Repository Port (Interface)
 * Defines the contract for grade level data access
 * Implementation will be provided by infrastructure layer
 */

import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";

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
   * Find all grade levels ordered by order field
   */
  abstract findAll(): Promise<GradeLevel[]>;

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
}
