import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { StudentAttendance } from "@/domain/attendance/entities/student-attendance.entity";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";

export interface UpdateAttendanceInput {
  attendanceId: string;
  checkinAt?: Date | null;
  checkoutAt?: Date | null;
  status?: AttendanceStatus;
  reason?: string | null;
  note?: string | null;
}

@Injectable()
export class UpdateAttendanceUseCase {
  private readonly logger = new Logger(UpdateAttendanceUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
  ) {}

  async execute(input: UpdateAttendanceInput): Promise<StudentAttendance> {
    this.logger.log(`Updating attendance ${input.attendanceId}`);

    // Step 1: Find existing attendance record
    const attendance = await this.attendanceRepository.findById(
      input.attendanceId,
    );
    if (!attendance) {
      throw new NotFoundException(
        `Attendance record with ID ${input.attendanceId} not found`,
      );
    }

    // Step 2: Update the attendance record
    attendance.update({
      checkinAt: input.checkinAt,
      checkoutAt: input.checkoutAt,
      status: input.status,
      reason: input.reason,
      note: input.note,
    });

    // Step 3: Save and return
    const updatedAttendance =
      await this.attendanceRepository.update(attendance);
    this.logger.log(`Attendance updated: ${updatedAttendance.id}`);

    return updatedAttendance;
  }
}
