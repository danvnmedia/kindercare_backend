import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

export interface GetStudentEnrollmentHistoryInput {
  studentId: string;
  campusId: string;
}

@Injectable()
export class GetStudentEnrollmentHistoryUseCase {
  private readonly logger = new Logger(GetStudentEnrollmentHistoryUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentEnrollmentHistoryInput,
  ): Promise<Enrollment[]> {
    this.logger.log(
      `Fetching enrollment history for student ${input.studentId}`,
    );

    // Resolve student. Cross-campus + missing both surface as 404 to hide
    // existence (matches AC-13 pattern across this module).
    const student = await this.studentRepository.findById(input.studentId);
    if (!student || student.campusId !== input.campusId) {
      throw new NotFoundException(
        `Student with ID ${input.studentId} not found`,
      );
    }

    // Repository eager-loads `class`, `class.schoolYear`, `class.gradeLevel`
    // and orders by `enrollmentDate DESC`, satisfying AC-25.
    const history = await this.enrollmentRepository.findAllByStudentId(
      input.studentId,
    );

    this.logger.log(
      `Found ${history.length} enrollment(s) in student ${input.studentId} history`,
    );
    return history;
  }
}
