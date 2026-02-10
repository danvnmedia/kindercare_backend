import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";

@Injectable()
export class GetAttendanceByIdUseCase {
  private readonly logger = new Logger(GetAttendanceByIdUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
  ) {}

  async execute(
    id: string,
    campusId?: string,
  ): Promise<StudentAttendanceSummary> {
    this.logger.log(`Getting attendance by ID: ${id}`);

    const summary = await this.attendanceRepository.findById(id);
    if (!summary) {
      throw new NotFoundException(`Attendance record with ID ${id} not found`);
    }

    // Verify attendance record belongs to the specified campus (if campusId provided)
    if (campusId && summary.campusId !== campusId) {
      throw new NotFoundException(
        `Attendance record with ID ${id} not found in this campus`,
      );
    }

    return summary;
  }
}
