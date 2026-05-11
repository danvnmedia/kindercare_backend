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
   * Find all enrollments for a class (active and historical).
   */
  abstract findByClassId(classId: string): Promise<Enrollment[]>;

  /**
   * Find all enrollments for a student (active and historical).
   */
  abstract findByStudentId(studentId: string): Promise<Enrollment[]>;

  /**
   * Find the student's currently active enrollment, if any.
   * Active means `endDate IS NULL`. The partial unique index
   * `idx_enrollment_one_active_per_student` guarantees at most one row.
   */
  abstract findActiveByStudentId(
    studentId: string,
  ): Promise<Enrollment | null>;

  /**
   * Find currently active enrollments for a class (`endDate IS NULL`),
   * ordered by `enrollmentDate DESC`. Used for the default class roster view.
   */
  abstract findActiveByClassId(classId: string): Promise<Enrollment[]>;

  /**
   * Find all enrollments for a class, including closed periods,
   * ordered by `enrollmentDate DESC`. Used when `includeHistorical=true`.
   */
  abstract findHistoricalByClassId(classId: string): Promise<Enrollment[]>;

  /**
   * Find all enrollments for a student across classes and periods,
   * ordered by `enrollmentDate DESC`. Used by the student class-history view.
   */
  abstract findAllByStudentId(studentId: string): Promise<Enrollment[]>;

  /**
   * Find all enrollments with filtering, sorting, pagination
   */
  abstract findAll(
    params: StandardRequest,
  ): Promise<PaginatedResult<Enrollment>>;

  /**
   * Save a new enrollment
   */
  abstract save(enrollment: Enrollment): Promise<Enrollment>;

  /**
   * Atomically persist a batch of new enrollments inside a single
   * transaction. Implementations MUST run all writes inside the same
   * transaction so a failure on any row rolls back the entire batch,
   * leaving zero rows persisted (specs/bulk-enrollment, D3).
   *
   * Returns the persisted entities in input order.
   */
  abstract saveMany(enrollments: Enrollment[]): Promise<Enrollment[]>;

  /**
   * Update existing enrollment
   */
  abstract update(enrollment: Enrollment): Promise<Enrollment>;

  /**
   * Atomically close an active enrollment and open a new one in a single
   * database transaction. Implementations MUST run both writes inside the
   * same transaction so that a failure of either rolls both back, leaving
   * the active row's `endDate=null` untouched.
   *
   * Used by `TransferStudentUseCase` to satisfy spec AC-20 (atomic transfer).
   */
  abstract transferEnrollment(
    closed: Enrollment,
    opened: Enrollment,
  ): Promise<{ closed: Enrollment; opened: Enrollment }>;
}
