/**
 * Enrollment Repository Port (Interface)
 * Defines the contract for enrollment data access
 * Implementation will be provided by infrastructure layer
 */

import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { EnrollmentEffectiveStatusFilter } from "../enrollment-effective-status-filter";

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

  /** Find the uncancelled enrollment effective on an inclusive date. */
  abstract findEffectiveByStudentIdAt(
    studentId: string,
    effectiveDate: Date,
  ): Promise<Enrollment | null>;

  /** Find future uncancelled periods after the supplied UTC date. */
  abstract findUpcomingByStudentId(
    studentId: string,
    referenceDate: Date,
  ): Promise<Enrollment[]>;

  /** Find an uncancelled null-end period without implying it is active today. */
  abstract findStructurallyOpenByStudentId(
    studentId: string,
  ): Promise<Enrollment | null>;

  /**
   * Find an uncancelled period whose inclusive interval overlaps the proposed
   * interval. A null proposed end is unbounded. `excludeEnrollmentId` supports
   * atomic source-close/target-open transfers.
   */
  abstract findOverlappingByStudentId(
    studentId: string,
    enrollmentDate: Date,
    endDate?: Date | null,
    excludeEnrollmentId?: string,
  ): Promise<Enrollment | null>;

  /** Resolve every child period belonging to one parent registration. */
  abstract findBySchoolYearEnrollmentId(
    schoolYearEnrollmentId: string,
  ): Promise<Enrollment[]>;

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
  /** @deprecated Use an explicit effective or structural query. */
  abstract findActiveByStudentId(studentId: string): Promise<Enrollment | null>;

  /**
   * Find class enrollment rows by authoritative date-effective status at one
   * UTC request boundary. ALL intentionally includes cancelled rows.
   */
  abstract findByClassIdAndEffectiveStatus(
    classId: string,
    effectiveStatus: EnrollmentEffectiveStatusFilter,
    referenceDate: Date,
  ): Promise<Enrollment[]>;

  /**
   * Find enrollments active for a class on a selected date. Active-on-date means
   * `enrollmentDate <= date` and `endDate IS NULL OR endDate >= date`.
   */
  abstract findActiveByClassIdOnDate(
    classId: string,
    date: Date,
  ): Promise<Enrollment[]>;

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
   * Save a new enrollment.
   *
   * Optional `tx` lets the caller join an outer transaction. When omitted, the
   * implementation uses its own connection (existing behavior). Used by the
   * enrollment-lifecycle use cases to participate in the audit-emit tx
   * (@doc/specs/admin-audit-log D4).
   */
  abstract save(
    enrollment: Enrollment,
    tx?: AppTransactionClient,
  ): Promise<Enrollment>;

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
   * Update existing enrollment.
   *
   * Optional `tx`: see `save` above.
   */
  abstract update(
    enrollment: Enrollment,
    tx?: AppTransactionClient,
  ): Promise<Enrollment>;

  /**
   * Atomically close an active enrollment and open a new one in a single
   * database transaction. Implementations MUST run both writes inside the
   * same transaction so that a failure of either rolls both back, leaving
   * the active row's `endDate=null` untouched.
   *
   * Used by `TransferStudentUseCase` to satisfy spec AC-20 (atomic transfer).
   *
   * Optional `tx`: when supplied, both writes run on the caller's transaction
   * (used by the audit wiring so the recorder emit joins the same tx); when
   * omitted, the implementation opens its own internal `$transaction`.
   */
  abstract transferEnrollment(
    closed: Enrollment,
    opened: Enrollment,
    tx?: AppTransactionClient,
  ): Promise<{ closed: Enrollment; opened: Enrollment }>;
}
