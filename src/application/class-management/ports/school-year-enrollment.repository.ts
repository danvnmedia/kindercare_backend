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
   * Persist a brand-new parent enrollment. Callers must have already verified
   * grade-level / school-year integrity at the use-case layer.
   */
  abstract save(
    entity: SchoolYearEnrollment,
  ): Promise<SchoolYearEnrollment>;

  /**
   * Persist mutable fields on an existing parent enrollment. Immutable FKs
   * (`studentId`, `campusId`, `schoolYearId`, `gradeLevelId`) and `createdAt`
   * are deliberately stripped by the mapper — see
   * `@doc/guides/code-generation-pattern#immutability`.
   */
  abstract update(
    entity: SchoolYearEnrollment,
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
   */
  abstract withdrawWithChildren(
    parent: SchoolYearEnrollment,
    openChild: Enrollment | null,
  ): Promise<{
    closedParent: SchoolYearEnrollment;
    closedChild: Enrollment | null;
  }>;
}
