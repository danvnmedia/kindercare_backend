import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";

export class RecordAttendanceRequest {
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiProperty({
    description: "Class ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsNotEmpty()
  @IsUUID()
  classId: string;

  @ApiProperty({
    description: "Attendance date",
    example: "2024-09-01",
  })
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @ApiProperty({
    description: "Attendance status",
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
    required: false,
    default: AttendanceStatus.PRESENT,
  })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiProperty({
    description: "Check-in time",
    example: "2024-09-01T08:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  checkinAt?: string;

  @ApiProperty({
    description: "Reason for absence or late",
    example: "Doctor appointment",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiProperty({
    description: "Additional notes",
    example: "Parent called ahead",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
