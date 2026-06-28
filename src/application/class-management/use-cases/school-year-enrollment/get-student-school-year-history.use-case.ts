import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

export interface GetStudentSchoolYearHistoryInput {
  studentId: string;
  campusId: string;
}

/**
 * Flat view shape returned to the controller and mapped 1:1 onto
 * `SchoolYearEnrollmentSummaryResponse`. The use case acts as a query handler
 * for the history endpoint, so the domain entity is never leaked through the
 * HTTP layer with a derived `childEnrollmentCount` glued on the side.
 *
 * See specs/school-year-enrollment-model AC-20 / AC-23.
 */
export interface SchoolYearEnrollmentHistoryView {
  id: string;
  studentId: string;
  campusId: string;
  schoolYearId: string;
  gradeLevelId: string;
  enrollmentDate: Date;
  exitDate: Date | null;
  exitReason: ExitReason | null;
  note: string | null;
  schoolYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  } | null;
  gradeLevel: {
    id: string;
    name: string;
    order: number;
  } | null;
  childEnrollmentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Returns the student's full SchoolYearEnrollment history, one row per year,
 * ordered `enrollmentDate DESC`, each row carrying the count of child
 * class-level enrollments captured under that parent. Cross-campus students
 * surface as 404 to hide existence (existing convention across this module).
 *
 * specs/school-year-enrollment-model AC-20, AC-23, AC-24.
 */
@Injectable()
export class GetStudentSchoolYearHistoryUseCase {
  private readonly logger = new Logger(GetStudentSchoolYearHistoryUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentSchoolYearHistoryInput,
  ): Promise<SchoolYearEnrollmentHistoryView[]> {
    this.logger.log(
      `Fetching school-year history for student ${input.studentId}`,
    );

    const student = await this.studentRepository.findById(input.studentId);
    if (!student || student.campusId !== input.campusId) {
      throw new NotFoundException(
        `Student with ID ${input.studentId} not found`,
      );
    }

    const rows =
      await this.schoolYearEnrollmentRepository.findAllByStudentIdWithChildCount(
        input.studentId,
      );

    this.logger.log(
      `Found ${rows.length} school-year enrollment(s) for student ${input.studentId}`,
    );

    return rows.map(({ enrollment, childEnrollmentCount }) => ({
      id: enrollment.id,
      studentId: enrollment.studentId,
      campusId: enrollment.campusId,
      schoolYearId: enrollment.schoolYearId,
      gradeLevelId: enrollment.gradeLevelId,
      enrollmentDate: enrollment.enrollmentDate,
      exitDate: enrollment.exitDate,
      exitReason: enrollment.exitReason,
      note: enrollment.note,
      schoolYear: enrollment.schoolYear
        ? {
            id: enrollment.schoolYear.id,
            name: enrollment.schoolYear.name,
            startDate: enrollment.schoolYear.startDate,
            endDate: enrollment.schoolYear.endDate,
          }
        : null,
      gradeLevel: enrollment.gradeLevel
        ? {
            id: enrollment.gradeLevel.id,
            name: enrollment.gradeLevel.name,
            order: enrollment.gradeLevel.order,
          }
        : null,
      childEnrollmentCount,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    }));
  }
}
