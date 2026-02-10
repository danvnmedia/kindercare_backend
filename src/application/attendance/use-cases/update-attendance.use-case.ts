import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";
import { StudentAttendanceLog } from "@/domain/attendance/entities/student-attendance-log.entity";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";
import { AttendanceLogType } from "@/domain/attendance/enums/attendance-log-type.enum";
import { AttendanceLogMethod } from "@/domain/attendance/enums/attendance-log-method.enum";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";

export interface UpdateAttendanceInput {
  attendanceId: string;
  // New check-in/check-out times (will create logs)
  checkinAt?: Date;
  checkoutAt?: Date;
  status?: AttendanceStatus;
  note?: string | null;
  // Audit fields
  updatedById?: string;
  method?: AttendanceLogMethod;
  deviceId?: string;
  imageFileId?: string;
}

export interface UpdateAttendanceResult {
  summary: StudentAttendanceSummary;
  newLogs: StudentAttendanceLog[];
}

@Injectable()
export class UpdateAttendanceUseCase {
  private readonly logger = new Logger(UpdateAttendanceUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
  ) {}

  async execute(input: UpdateAttendanceInput): Promise<UpdateAttendanceResult> {
    this.logger.log(`Updating attendance ${input.attendanceId}`);

    // Step 1: Find existing attendance summary
    const summary = await this.attendanceRepository.findById(
      input.attendanceId,
    );
    if (!summary) {
      throw new NotFoundException(
        `Attendance record with ID ${input.attendanceId} not found`,
      );
    }

    // Step 2: Get existing logs to recalculate cached times
    const existingLogs = await this.attendanceRepository.findLogsBySummaryId(
      input.attendanceId,
    );

    const newLogs: StudentAttendanceLog[] = [];
    const method = input.method ?? AttendanceLogMethod.MANUAL_ENTRY;

    // Step 3: Create new logs if time changes provided
    if (input.checkinAt) {
      const checkinLog = StudentAttendanceLog.create({
        attendanceSummaryId: summary.id,
        type: AttendanceLogType.CHECK_IN,
        timestamp: input.checkinAt,
        method,
        deviceId: input.deviceId ?? null,
        createdById: input.updatedById ?? null,
        imageFileId: input.imageFileId ?? null,
      });
      newLogs.push(checkinLog);
    }

    if (input.checkoutAt) {
      const checkoutLog = StudentAttendanceLog.create({
        attendanceSummaryId: summary.id,
        type: AttendanceLogType.CHECK_OUT,
        timestamp: input.checkoutAt,
        method,
        deviceId: input.deviceId ?? null,
        createdById: input.updatedById ?? null,
        imageFileId: input.imageFileId ?? null,
      });
      newLogs.push(checkoutLog);
    }

    // Step 4: Save new logs
    let allLogs = [...existingLogs];
    if (newLogs.length > 0) {
      const savedLogs = await this.attendanceRepository.saveLogs(newLogs);
      allLogs = [...existingLogs, ...savedLogs];
    }

    // Step 5: Recalculate cached times from all logs
    summary.recalculateCachedTimes(allLogs);

    // Step 6: Update other fields
    if (input.status !== undefined) {
      summary.updateStatus(input.status, input.updatedById);
    }
    if (input.note !== undefined) {
      summary.update({ note: input.note });
    }
    if (input.updatedById) {
      summary.update({ updatedById: input.updatedById });
    }

    // Step 7: Save updated summary
    const updatedSummary = await this.attendanceRepository.update(summary);
    this.logger.log(
      `Attendance updated: ${updatedSummary.id}, new logs: ${newLogs.length}`,
    );

    return {
      summary: updatedSummary,
      newLogs,
    };
  }
}
