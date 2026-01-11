import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { AttendanceStatus } from "@/domain/attendance/enums/attendance-status.enum";

export class UpdateAttendanceRequest {
  @ApiProperty({
    description: "Check-in time",
    example: "2024-09-01T08:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  checkinAt?: string | null;

  @ApiProperty({
    description: "Check-out time",
    example: "2024-09-01T16:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  checkoutAt?: string | null;

  @ApiProperty({
    description: "Attendance status",
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
    required: false,
  })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiProperty({
    description: "Reason for absence or late",
    example: "Doctor appointment",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;

  @ApiProperty({
    description: "Additional notes",
    example: "Parent called ahead",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
