import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";
import { AttendanceLogType } from "@/domain/attendance/enums/attendance-log-type.enum";
import { AttendanceLogMethod } from "@/domain/attendance/enums/attendance-log-method.enum";
import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";

export class AttendanceStudentInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyễn Văn A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "Bé A", nullable: true })
  nickname: string | null;

  @Expose()
  @ApiProperty({ example: "STU001", nullable: true })
  studentCode: string | null;
}

export class AttendanceClassInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp A1" })
  name: string;
}

export class StudentAttendanceLogResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({
    example: AttendanceLogType.CHECK_IN,
    enum: AttendanceLogType,
    description: "Log event type",
  })
  type: AttendanceLogType;

  @Expose()
  @ApiProperty({ example: "2024-09-01T08:00:00.000Z" })
  timestamp: Date;

  @Expose()
  @ApiProperty({
    example: AttendanceLogMethod.TEACHER_APP,
    enum: AttendanceLogMethod,
    description: "How the event was recorded",
  })
  method: AttendanceLogMethod;

  @Expose()
  @ApiProperty({ example: "device-123", nullable: true })
  deviceId: string | null;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000", nullable: true })
  createdById: string | null;

  @Expose()
  @ApiProperty({ example: "Arrived with parent", nullable: true })
  note: string | null;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000", nullable: true })
  imageFileId: string | null;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;
}

export class StudentAttendanceResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  studentId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  classId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "2024-09-01T00:00:00.000Z" })
  date: Date;

  @Expose()
  @ApiProperty({ example: "2024-09-01T08:00:00.000Z", nullable: true })
  firstCheckinAt: Date | null;

  @Expose()
  @ApiProperty({ example: "2024-09-01T16:00:00.000Z", nullable: true })
  lastCheckoutAt: Date | null;

  @Expose()
  @ApiProperty({
    example: AttendanceStatus.PRESENT,
    enum: AttendanceStatus,
    description: "Attendance status",
  })
  status: AttendanceStatus;

  @Expose()
  @ApiProperty({ example: "Parent called ahead", nullable: true })
  note: string | null;

  // New fields
  @Expose()
  @ApiProperty({ example: 480, description: "Total minutes present for the day" })
  totalMinutesPresent: number;

  @Expose()
  @Type(() => AttendanceStudentInfo)
  @ApiProperty({ type: AttendanceStudentInfo, required: false })
  student?: AttendanceStudentInfo;

  @Expose()
  @Type(() => AttendanceClassInfo)
  @ApiProperty({ type: AttendanceClassInfo, required: false })
  class?: AttendanceClassInfo;

  // Optional logs array
  @Expose()
  @Type(() => StudentAttendanceLogResponse)
  @ApiProperty({ type: [StudentAttendanceLogResponse], required: false })
  logs?: StudentAttendanceLogResponse[];

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;

  /**
   * Maps a StudentAttendanceSummary domain entity to response DTO
   */
  static fromDomain(summary: StudentAttendanceSummary): StudentAttendanceResponse {
    const response = new StudentAttendanceResponse();
    response.id = summary.id;
    response.studentId = summary.studentId;
    response.classId = summary.classId;
    response.campusId = summary.campusId;
    response.date = summary.date;
    response.firstCheckinAt = summary.firstCheckinAt;
    response.lastCheckoutAt = summary.lastCheckoutAt;
    response.status = summary.status;
    response.note = summary.note;
    response.totalMinutesPresent = summary.totalMinutesPresent;
    response.createdAt = summary.createdAt;
    response.updatedAt = summary.updatedAt;

    // Map relations if loaded
    if (summary.student) {
      response.student = {
        id: summary.student.id,
        fullName: summary.student.fullName,
        nickname: summary.student.nickname ?? null,
        studentCode: summary.student.studentCode ?? null,
      };
    }

    if (summary.class) {
      response.class = {
        id: summary.class.id,
        name: summary.class.name,
      };
    }

    if (summary.logs) {
      response.logs = summary.logs.map((log) => ({
        id: log.id,
        type: log.type,
        timestamp: log.timestamp,
        method: log.method,
        deviceId: log.deviceId,
        createdById: log.createdById,
        note: log.note,
        imageFileId: log.imageFileId,
        createdAt: log.createdAt,
      }));
    }

    return response;
  }
}

export class BulkRecordAttendanceSkippedItem {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  studentId: string;

  @Expose()
  @ApiProperty({ example: "Attendance already recorded for this date" })
  reason: string;
}

export class BulkRecordAttendanceResponse {
  @Expose()
  @Type(() => StudentAttendanceResponse)
  @ApiProperty({ type: [StudentAttendanceResponse] })
  created: StudentAttendanceResponse[];

  @Expose()
  @Type(() => BulkRecordAttendanceSkippedItem)
  @ApiProperty({ type: [BulkRecordAttendanceSkippedItem] })
  skipped: BulkRecordAttendanceSkippedItem[];
}
