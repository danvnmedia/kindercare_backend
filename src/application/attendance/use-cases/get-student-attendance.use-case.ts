import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

export interface GetStudentAttendanceInput {
  campusId: string;
  studentId: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class GetStudentAttendanceUseCase {
  private readonly logger = new Logger(GetStudentAttendanceUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: GetStudentAttendanceInput,
  ): Promise<StudentAttendanceSummary[]> {
    const startStr = input.startDate.toISOString().split("T")[0];
    const endStr = input.endDate.toISOString().split("T")[0];
    this.logger.log(
      `Getting attendance for student ${input.studentId} from ${startStr} to ${endStr}`,
    );

    // Step 1: Validate student exists and belongs to campus
    const student = await this.studentRepository.findById(input.studentId);
    if (!student) {
      throw new NotFoundException(
        `Student with ID ${input.studentId} not found`,
      );
    }
    if (student.campusId !== input.campusId) {
      throw new BadRequestException(`Student does not belong to this campus`);
    }

    // Step 2: Validate date range
    if (input.startDate > input.endDate) {
      throw new BadRequestException(
        `Start date must be before or equal to end date`,
      );
    }

    // Step 3: Get attendance summaries
    const summaries = await this.attendanceRepository.findByStudentDateRange(
      input.studentId,
      input.startDate,
      input.endDate,
    );

    this.logger.log(`Found ${summaries.length} attendance records`);
    return summaries;
  }
}
