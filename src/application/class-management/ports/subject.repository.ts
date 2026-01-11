/**
 * Subject Repository Port (Interface)
 * Defines the contract for subject data access
 * Implementation will be provided by infrastructure layer
 */

import { Subject } from "@/domain/class-management/entities/subject.entity";

export abstract class SubjectRepository {
  /**
   * Find subject by ID
   */
  abstract findById(id: string): Promise<Subject | null>;

  /**
   * Find subject by name within a campus
   */
  abstract findByNameAndCampus(
    name: string,
    campusId: string,
  ): Promise<Subject | null>;

  /**
   * Find all subjects for a campus
   */
  abstract findAll(campusId: string): Promise<Subject[]>;

  /**
   * Save a new subject
   */
  abstract save(subject: Subject): Promise<Subject>;

  /**
   * Update existing subject
   */
  abstract update(subject: Subject): Promise<Subject>;

  /**
   * Delete subject
   */
  abstract delete(id: string): Promise<void>;
}
