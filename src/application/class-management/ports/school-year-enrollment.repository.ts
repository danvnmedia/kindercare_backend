/**
 * SchoolYearEnrollment Repository Port (Interface)
 *
 * Defines the persistence contract for the parent enrollment row that anchors
 * a student to a school year + grade level. Implementation lives in the
 * infrastructure layer.
 *
 * Lifecycle invariants (see specs/school-year-enrollment-model):
 *  - D2: period-only lifecycle (`exitDate IS NULL` means "active")
 *  - D6: at most one open parent per `(studentId, schoolYearId)`, enforced
 *    by partial unique index `idx_sye_one_open_per_year`
 */

import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export type SchoolYearStudentSegment =
  | "registered"
  | "upcoming"
  | "active"
  | "unassigned"
  | "withdrawn"
  | "completed"
  | "graduated"
  | "unresolved";

export type SchoolYearStudentClassAssignmentState =
  | "UPCOMING"
  | "ACTIVE"
  | "CLOSED"
  | "CANCELLED"
  | "NONE";

export interface SchoolYearStudentListFilters {
  segment?: SchoolYearStudentSegment;
  search?: string;
}

export interface SchoolYearStudentListItem {
  enrollment: SchoolYearEnrollment;
  childEnrollmentCount: number;
  classAssignment: Enrollment | null;
  classAssignmentState: SchoolYearStudentClassAssignmentState;
}

export abstract class SchoolYearEnrollmentRepository {
  /**
   * Find a parent enrollment by primary key.
   */
  abstract findById(id: string): Promise<SchoolYearEnrollment | null>;

  /**
   * Find the student's currently-open parent for the given school year, if
   * any. "Open" means `exitDate IS NULL`. The partial unique index
   * `idx_sye_one_open_per_year` guarantees at most one row.
   *
   * Used by the class-enrollment use cases (D1) as the parent-existence gate
   * and (D3) for grade-level match validation.
   */
  abstract findOpenByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
  ): Promise<SchoolYearEnrollment | null>;

  /** Find an uncancelled null-exit parent without implying date effectiveness. */
  abstract findStructurallyOpenByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
  ): Promise<SchoolYearEnrollment | null>;

  /** Find an uncancelled parent whose inclusive period covers the date. */
  abstract findCoveringDateByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
    effectiveDate: Date,
  ): Promise<SchoolYearEnrollment | null>;

  /** Find uncancelled future parent rows after the reference date. */
  abstract findUpcomingByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
    referenceDate: Date,
  ): Promise<SchoolYearEnrollment[]>;

  /**
   * Find the latest parent row for a student in a school year, open or closed.
   * Used by read-only readiness checks to distinguish "no registration" from
   * "registration exists but is already closed" without mutating data.
   */
  abstract findLatestByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
  ): Promise<SchoolYearEnrollment | null>;

  /**
   * Find every parent enrollment for a student across school years, ordered
   * by `enrollmentDate DESC`. Backs the student-school-year-history view.
   */
  abstract findAllByStudentId(
    studentId: string,
  ): Promise<SchoolYearEnrollment[]>;

  /**
   * Same as `findAllByStudentId` but augments each row with the count of
   * child class-level Enrollment rows for that school year. Used by
   * `GetStudentSchoolYearHistoryUseCase` to render the history view
   * (specs/school-year-enrollment-model AC-23).
   *
   * Ordered `enrollmentDate DESC`. Returns an empty array when the student
   * has no parent rows.
   */
  abstract findAllByStudentIdWithChildCount(
    studentId: string,
  ): Promise<
    Array<{ enrollment: SchoolYearEnrollment; childEnrollmentCount: number }>
  >;

  /**
   * Find parent enrollment rows for one campus + school year with pagination,
   * search, and history-view segments. Backs the year-scoped student list.
   */
  abstract findStudentsBySchoolYear(
    campusId: string,
    schoolYearId: string,
    params: StandardRequest,
    referenceDate: Date,
    filters?: SchoolYearStudentListFilters,
  ): Promise<PaginatedResult<SchoolYearStudentListItem>>;

  /**
   * Count child class-level Enrollment rows attached to a parent
   * SchoolYearEnrollment. Grade correction is only allowed while this count is
   * zero.
   */
  abstract countChildEnrollments(
    schoolYearEnrollmentId: string,
  ): Promise<number>;

  /**
   * Persist a brand-new parent enrollment. Callers must have already verified
   * grade-level / school-year integrity at the use-case layer.
   *
   * Optional `tx` lets the caller join an outer transaction (used by the
   * audit-emit wiring per @doc/specs/admin-audit-log D4); when omitted, the
   * implementation uses its own connection (existing behavior).
   */
  abstract save(
    entity: SchoolYearEnrollment,
    tx?: AppTransactionClient,
  ): Promise<SchoolYearEnrollment>;

  /**
   * Persist mutable fields on an existing parent enrollment. Immutable FKs
   * (`studentId`, `campusId`, `schoolYearId`, `gradeLevelId`) and `createdAt`
   * are deliberately stripped by the mapper — see
   * `@doc/guides/code-generation-pattern#immutability`.
   */
  abstract update(entity: SchoolYearEnrollment): Promise<SchoolYearEnrollment>;

  /**
   * Dedicated persistence path for grade correction before class placement.
   * This intentionally keeps `update()` immutable for normal lifecycle writes.
   */
  abstract correctGradeLevel(
    id: string,
    gradeLevelId: string,
    tx?: AppTransactionClient,
  ): Promise<SchoolYearEnrollment>;

  /**
   * Atomically close the parent row and (optionally) the single open child
   * class-enrollment row in a single database transaction. Failure of either
   * write rolls both back, leaving `exitDate IS NULL` on both rows.
   *
   * Pass `openChild = null` when the student has no open class enrollment for
   * this school year — the parent row alone will be closed.
   *
   * Satisfies specs/school-year-enrollment-model D4 (atomic cascade).
   *
   * Optional `tx`: when supplied, both writes run on the caller's transaction
   * (used by the audit wiring so the recorder emit joins the same tx); when
   * omitted, the implementation opens its own internal `$transaction`.
   */
  abstract withdrawWithChildren(
    parent: SchoolYearEnrollment,
    openChild: Enrollment | null,
    tx?: AppTransactionClient,
  ): Promise<{
    closedParent: SchoolYearEnrollment;
    closedChild: Enrollment | null;
  }>;
}
