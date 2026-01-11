import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";

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
  checkinAt: Date | null;

  @Expose()
  @ApiProperty({ example: "2024-09-01T16:00:00.000Z", nullable: true })
  checkoutAt: Date | null;

  @Expose()
  @ApiProperty({
    example: AttendanceStatus.PRESENT,
    enum: AttendanceStatus,
    description: "Attendance status",
  })
  status: AttendanceStatus;

  @Expose()
  @ApiProperty({ example: "Doctor appointment", nullable: true })
  reason: string | null;

  @Expose()
  @ApiProperty({ example: "Parent called ahead", nullable: true })
  note: string | null;

  @Expose()
  @Type(() => AttendanceStudentInfo)
  @ApiProperty({ type: AttendanceStudentInfo, required: false })
  student?: AttendanceStudentInfo;

  @Expose()
  @Type(() => AttendanceClassInfo)
  @ApiProperty({ type: AttendanceClassInfo, required: false })
  class?: AttendanceClassInfo;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
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
