/**
 * Enrollment Repository Port (Interface)
 * Defines the contract for enrollment data access
 * Implementation will be provided by infrastructure layer
 */

import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class EnrollmentRepository {
  /**
   * Find enrollment by ID
   */
  abstract findById(id: string): Promise<Enrollment | null>;

  /**
   * Find enrollment by student, class, and date
   */
  abstract findByStudentClassDate(
    studentId: string,
    classId: string,
    enrollmentDate: Date,
  ): Promise<Enrollment | null>;

  /**
   * Find all enrollments for a class
   */
  abstract findByClassId(classId: string): Promise<Enrollment[]>;

  /**
   * Find all enrollments for a student
   */
  abstract findByStudentId(studentId: string): Promise<Enrollment[]>;

  /**
   * Find all enrollments with filtering, sorting, pagination
   */
  abstract findAll(params: StandardRequest): Promise<PaginatedResult<Enrollment>>;

  /**
   * Save a new enrollment
   */
  abstract save(enrollment: Enrollment): Promise<Enrollment>;

  /**
   * Update existing enrollment
   */
  abstract update(enrollment: Enrollment): Promise<Enrollment>;

  /**
   * Delete enrollment
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Delete all enrollments for a student in a class
   */
  abstract deleteByStudentAndClass(studentId: string, classId: string): Promise<void>;
}
