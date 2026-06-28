import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";
import { StudentAttendanceLog } from "@/domain/attendance/entities/student-attendance-log.entity";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";
import { AttendanceLogType } from "@/domain/attendance/enums/attendance-log-type.enum";
import { AttendanceLogMethod } from "@/domain/attendance/enums/attendance-log-method.enum";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

export interface RecordAttendanceInput {
  campusId: string;
  studentId: string;
  classId: string;
  date: Date;
  status?: AttendanceStatus;
  checkinAt?: Date;
  note?: string;
  // Log-specific fields
  method?: AttendanceLogMethod;
  deviceId?: string;
  createdById?: string;
  imageFileId?: string;
}

export interface RecordAttendanceResult {
  summary: StudentAttendanceSummary;
  log: StudentAttendanceLog;
}

@Injectable()
export class RecordAttendanceUseCase {
  private readonly logger = new Logger(RecordAttendanceUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(input: RecordAttendanceInput): Promise<RecordAttendanceResult> {
    this.logger.log(
      `Recording attendance for student ${input.studentId} on ${input.date.toISOString().split("T")[0]}`,
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

    // Step 2: Validate class exists and belongs to campus
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }
    if (classEntity.campusId !== input.campusId) {
      throw new BadRequestException(`Class does not belong to this campus`);
    }

    // Step 3: Check for duplicate attendance (unique studentId + date)
    const existingAttendance =
      await this.attendanceRepository.findByStudentAndDate(
        input.studentId,
        input.date,
      );
    if (existingAttendance) {
      throw new ConflictException(
        `Attendance record already exists for this student on this date`,
      );
    }

    // Step 4: Determine check-in time
    const checkinTime = input.checkinAt ?? new Date();

    // Step 5: Create attendance summary
    const summary = StudentAttendanceSummary.create({
      campusId: input.campusId,
      studentId: input.studentId,
      classId: input.classId,
      date: input.date,
      status: input.status ?? AttendanceStatus.PRESENT,
      firstCheckinAt: checkinTime,
      note: input.note ?? null,
    });

    // Step 6: Create initial CHECK_IN log
    const log = StudentAttendanceLog.create({
      attendanceSummaryId: summary.id, // Will be set properly by repository
      type: AttendanceLogType.CHECK_IN,
      timestamp: checkinTime,
      method: input.method ?? AttendanceLogMethod.TEACHER_APP,
      deviceId: input.deviceId ?? null,
      createdById: input.createdById ?? null,
      note: input.note ?? null,
      imageFileId: input.imageFileId ?? null,
    });

    // Step 7: Save both atomically
    const result = await this.attendanceRepository.saveSummaryWithLog(
      summary,
      log,
    );
    this.logger.log(
      `Attendance recorded: summary=${result.summary.id}, log=${result.log.id}`,
    );

    return result;
  }
}
