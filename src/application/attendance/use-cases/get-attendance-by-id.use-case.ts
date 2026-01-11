import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { StudentAttendance } from "@/domain/attendance/entities/student-attendance.entity";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";

@Injectable()
export class GetAttendanceByIdUseCase {
  private readonly logger = new Logger(GetAttendanceByIdUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
  ) {}

  async execute(id: string): Promise<StudentAttendance> {
    this.logger.log(`Getting attendance by ID: ${id}`);

    const attendance = await this.attendanceRepository.findById(id);
    if (!attendance) {
      throw new NotFoundException(`Attendance record with ID ${id} not found`);
    }

    return attendance;
  }
}
