/**
 * Student Repository Port (Interface)
 * Defines the contract for student data access
 * Implementation will be provided by infrastructure layer
 */

import { Student } from "@/domain/user-management/entities/student.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class StudentRepository {
  /**
   * Find student by ID
   */
  abstract findById(id: string): Promise<Student | null>;

  /**
   * Find student by email (global search across all campuses)
   */
  abstract findByEmail(email: string): Promise<Student | null>;

  /**
   * Find student by email within a specific campus (campus-scoped uniqueness)
   */
  abstract findByEmailInCampus(
    campusId: string,
    email: string,
  ): Promise<Student | null>;

  /**
   * Find student by phone number (global search across all campuses)
   */
  abstract findByPhoneNumber(phoneNumber: string): Promise<Student | null>;

  /**
   * Find student by phone number within a specific campus (campus-scoped uniqueness)
   */
  abstract findByPhoneNumberInCampus(
    campusId: string,
    phoneNumber: string,
  ): Promise<Student | null>;

  /**
   * Find student by student code within a specific campus (campus-scoped uniqueness)
   */
  abstract findByStudentCodeInCampus(
    campusId: string,
    studentCode: string,
  ): Promise<Student | null>;

  /**
   * Find students by campus ID
   */
  abstract findByCampusId(campusId: string): Promise<Student[]>;

  /**
   * Find multiple students by IDs
   */
  abstract findByIds(ids: string[]): Promise<Student[]>;

  /**
   * Find all students with filtering, sorting, pagination using StandardRequest
   * @param params - Standard query parameters (filters, sorts, pagination)
   * @param scope - Optional system-enforced filters (e.g., campusId) that bypass allowedFilterFields
   */
  abstract findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Student>>;

  /**
   * Find students eligible to be enrolled into the given class.
   *
   * A student is "eligible" iff:
   *   - student.isArchived = false
   *   - student is at `scope.campusId` (system-enforced; cannot be overridden)
   *   - NOT EXISTS any enrollment row for this student with endDate IS NULL
   *     (the student is not currently active in ANY class — including the
   *     target class itself, per specs/bulk-enrollment AC-13)
   *
   * Phase narrowing (ACTIVE/WAITING/DEFERRED/GRADUATED/WITHDRAWN) is a
   * client-side concern — the eligibility predicate intentionally does not
   * filter by `phase` (see @doc/specs/student-status-simplification D9 / FR-11).
   *
   * Pagination, sort, and search go through the standard PrismaQueryService
   * path so list-endpoint semantics stay consistent with `findAll`.
   *
   * @param classId - The target class id. Reserved for future filters (e.g.
   *   excluding students with a prior closed enrollment in this class). Today
   *   the campus scoping comes from `scope.campusId`, which the caller derives
   *   from `class.campusId` after a cross-campus 404 check (D5).
   * @param params - Standard query parameters (filters, sorts, pagination).
   * @param scope - System-enforced filters; `campusId` is required for campus
   *   isolation.
   */
  abstract findEligibleForClass(
    classId: string,
    params: StandardRequest,
    scope?: { campusId: string },
  ): Promise<PaginatedResult<Student>>;

  /**
   * Save a new or existing student
   */
  abstract save(student: Student): Promise<Student>;

  /**
   * Update existing student
   */
  abstract update(student: Student): Promise<Student>;

  /**
   * Delete student
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Assign guardians to student
   * @param studentId - Student ID
   * @param guardianRelations - Array of { guardianId, relationshipId }
   */
  abstract assignGuardians(
    studentId: string,
    guardianRelations: Array<{ guardianId: string; relationshipId: string }>,
  ): Promise<void>;

  /**
   * Remove guardians from student
   */
  abstract removeGuardians(
    studentId: string,
    guardianIds: string[],
  ): Promise<void>;

  /**
   * Update the relationship type on an existing student-guardian link row.
   * Caller is responsible for verifying the row exists; this performs the
   * raw UPDATE on the composite key.
   */
  abstract updateGuardianRelationship(
    studentId: string,
    guardianId: string,
    relationshipId: string,
  ): Promise<void>;

  /**
   * Get student guardians
   */
  abstract getStudentGuardians(studentId: string): Promise<any[]>;
}
