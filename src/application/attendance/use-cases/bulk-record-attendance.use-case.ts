import {
  Injectable,
  Inject,
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

export interface AttendanceRecord {
  studentId: string;
  status?: AttendanceStatus;
  checkinAt?: Date;
  note?: string;
  // Log-specific fields
  method?: AttendanceLogMethod;
  deviceId?: string;
  createdById?: string;
  imageFileId?: string;
}

export interface BulkRecordAttendanceInput {
  campusId: string;
  classId: string;
  date: Date;
  records: AttendanceRecord[];
  // Default method for all records if not specified per record
  defaultMethod?: AttendanceLogMethod;
  defaultCreatedById?: string;
}

export interface BulkRecordAttendanceResult {
  created: Array<{
    summary: StudentAttendanceSummary;
    log: StudentAttendanceLog;
  }>;
  skipped: Array<{ studentId: string; reason: string }>;
}

@Injectable()
export class BulkRecordAttendanceUseCase {
  private readonly logger = new Logger(BulkRecordAttendanceUseCase.name);

  constructor(
    @Inject("STUDENT_ATTENDANCE_REPOSITORY")
    private readonly attendanceRepository: StudentAttendanceRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    input: BulkRecordAttendanceInput,
  ): Promise<BulkRecordAttendanceResult> {
    const dateStr = input.date.toISOString().split("T")[0];
    this.logger.log(
      `Bulk recording attendance for class ${input.classId} on ${dateStr}: ${input.records.length} records`,
    );

    // Step 1: Validate class exists and belongs to campus
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }
    if (classEntity.campusId !== input.campusId) {
      throw new BadRequestException(`Class does not belong to this campus`);
    }

    const skipped: Array<{ studentId: string; reason: string }> = [];
    const toCreate: Array<{
      summary: StudentAttendanceSummary;
      log: StudentAttendanceLog;
    }> = [];

    // Step 2a: Batch-load students and existing attendances to avoid N+1 queries
    const uniqueStudentIds = [
      ...new Set(input.records.map((r) => r.studentId)),
    ];
    const students = await this.studentRepository.findByIds(uniqueStudentIds);
    const studentById = new Map(
      students.map((student) => [student.id, student]),
    );

    const existingAttendances = await Promise.all(
      uniqueStudentIds.map(async (studentId) => ({
        studentId,
        attendance: await this.attendanceRepository.findByStudentAndDate(
          studentId,
          input.date,
        ),
      })),
    );
    const existingByStudentId = new Map(
      existingAttendances.map((entry) => [entry.studentId, entry.attendance]),
    );
    const seenStudentIds = new Set<string>();

    // Step 2: Validate each record and prepare for creation
    for (const record of input.records) {
      try {
        // Guard duplicate student IDs in the same bulk request
        if (seenStudentIds.has(record.studentId)) {
          skipped.push({
            studentId: record.studentId,
            reason: "Duplicate student in request payload",
          });
          continue;
        }
        seenStudentIds.add(record.studentId);

        // Validate student exists and belongs to campus
        const student = studentById.get(record.studentId);
        if (!student) {
          skipped.push({
            studentId: record.studentId,
            reason: "Student not found",
          });
          continue;
        }
        if (student.campusId !== input.campusId) {
          skipped.push({
            studentId: record.studentId,
            reason: "Student does not belong to this campus",
          });
          continue;
        }

        // Check for existing attendance
        const existingAttendance = existingByStudentId.get(record.studentId);
        if (existingAttendance) {
          skipped.push({
            studentId: record.studentId,
            reason: "Attendance already recorded for this date",
          });
          continue;
        }

        // Determine check-in time
        const checkinTime = record.checkinAt ?? new Date();

        // Create attendance summary
        const summary = StudentAttendanceSummary.create({
          campusId: input.campusId,
          studentId: record.studentId,
          classId: input.classId,
          date: input.date,
          status: record.status ?? AttendanceStatus.PRESENT,
          firstCheckinAt: checkinTime,
          note: record.note ?? null,
        });

        // Create initial CHECK_IN log
        const log = StudentAttendanceLog.create({
          attendanceSummaryId: summary.id, // Will be set properly by repository
          type: AttendanceLogType.CHECK_IN,
          timestamp: checkinTime,
          method:
            record.method ??
            input.defaultMethod ??
            AttendanceLogMethod.TEACHER_APP,
          deviceId: record.deviceId ?? null,
          createdById: record.createdById ?? input.defaultCreatedById ?? null,
          note: record.note ?? null,
          imageFileId: record.imageFileId ?? null,
        });

        toCreate.push({ summary, log });
      } catch (error) {
        skipped.push({
          studentId: record.studentId,
          reason: error.message,
        });
      }
    }

    // Step 3: Save all valid attendance records atomically
    let created: Array<{
      summary: StudentAttendanceSummary;
      log: StudentAttendanceLog;
    }> = [];

    if (toCreate.length > 0) {
      created =
        await this.attendanceRepository.saveManySummariesWithLogs(toCreate);
    }

    this.logger.log(
      `Bulk attendance recorded: ${created.length} created, ${skipped.length} skipped`,
    );

    return { created, skipped };
  }
}
