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

export interface RecordAttendanceInput {
  campusId: string;
  studentId: string;
  classId: string;
  date: Date;
  status?: AttendanceStatus;
  checkinAt?: Date;
  reason?: string;
  note?: string;
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

  async execute(input: RecordAttendanceInput): Promise<StudentAttendance> {
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

    // Step 4: Create and save attendance record
    const attendance = StudentAttendance.create({
      campusId: input.campusId,
      studentId: input.studentId,
      classId: input.classId,
      date: input.date,
      status: input.status ?? AttendanceStatus.PRESENT,
      checkinAt: input.checkinAt ?? null,
      reason: input.reason ?? null,
      note: input.note ?? null,
    });

    const savedAttendance = await this.attendanceRepository.save(attendance);
    this.logger.log(`Attendance recorded: ${savedAttendance.id}`);

    return savedAttendance;
  }
}
