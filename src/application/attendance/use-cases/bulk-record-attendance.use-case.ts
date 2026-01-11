import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { StudentAttendance } from "@/domain/attendance/entities/student-attendance.entity";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";
import { StudentAttendanceRepository } from "../ports/student-attendance.repository";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

export interface AttendanceRecord {
  studentId: string;
  status?: AttendanceStatus;
  checkinAt?: Date;
  reason?: string;
  note?: string;
}

export interface BulkRecordAttendanceInput {
  campusId: string;
  classId: string;
  date: Date;
  records: AttendanceRecord[];
}

export interface BulkRecordAttendanceResult {
  created: StudentAttendance[];
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

    const created: StudentAttendance[] = [];
    const skipped: Array<{ studentId: string; reason: string }> = [];
    const toCreate: StudentAttendance[] = [];

    // Step 2: Validate each record and prepare for creation
    for (const record of input.records) {
      try {
        // Validate student exists and belongs to campus
        const student = await this.studentRepository.findById(record.studentId);
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
        const existingAttendance =
          await this.attendanceRepository.findByStudentAndDate(
            record.studentId,
            input.date,
          );
        if (existingAttendance) {
          skipped.push({
            studentId: record.studentId,
            reason: "Attendance already recorded for this date",
          });
          continue;
        }

        // Create attendance entity
        const attendance = StudentAttendance.create({
          campusId: input.campusId,
          studentId: record.studentId,
          classId: input.classId,
          date: input.date,
          status: record.status ?? AttendanceStatus.PRESENT,
          checkinAt: record.checkinAt ?? null,
          reason: record.reason ?? null,
          note: record.note ?? null,
        });

        toCreate.push(attendance);
      } catch (error) {
        skipped.push({
          studentId: record.studentId,
          reason: error.message,
        });
      }
    }

    // Step 3: Save all valid attendance records
    if (toCreate.length > 0) {
      const savedAttendances =
        await this.attendanceRepository.saveMany(toCreate);
      created.push(...savedAttendances);
    }

    this.logger.log(
      `Bulk attendance recorded: ${created.length} created, ${skipped.length} skipped`,
    );

    return { created, skipped };
  }
}
