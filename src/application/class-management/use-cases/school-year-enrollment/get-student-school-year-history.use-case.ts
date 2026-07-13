import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  buildHistoricalSchoolYearEnrollmentView,
  HistoricalSchoolYearEnrollmentView,
} from "../../historical-record-view";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";

export interface GetStudentSchoolYearHistoryInput {
  studentId: string;
  campusId: string;
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
    private readonly historicalRecordRepository: HistoricalRecordRepository,
  ) {}

  async execute(
    input: GetStudentSchoolYearHistoryInput,
  ): Promise<HistoricalSchoolYearEnrollmentView[]> {
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
    const referenceDate = new Date();

    this.logger.log(
      `Found ${rows.length} school-year enrollment(s) for student ${input.studentId}`,
    );

    return Promise.all(
      rows.map(async ({ enrollment, childEnrollmentCount }) =>
        buildHistoricalSchoolYearEnrollmentView(
          enrollment,
          childEnrollmentCount,
          await this.historicalRecordRepository.findCorrections(
            "SCHOOL_YEAR_ENROLLMENT",
            enrollment.id,
          ),
          referenceDate,
        ),
      ),
    );
  }
}
