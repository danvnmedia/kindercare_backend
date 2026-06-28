import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

import { AbsenceRequestType } from "@/domain/absence-request";

export class CreateAbsenceRequestRequest {
  @ApiProperty({
    description: "Student UUID linked to the authenticated guardian.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  studentId: string;

  @ApiProperty({
    enum: AbsenceRequestType,
    example: AbsenceRequestType.FULL_DAY,
  })
  @IsEnum(AbsenceRequestType)
  absenceType: AbsenceRequestType;

  @ApiProperty({
    description: "Date-only absence start.",
    example: "2026-07-10",
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: "Date-only absence end. Defaults to startDate when omitted.",
    example: "2026-07-10",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: "Required for PARTIAL_DAY requests, omitted for FULL_DAY.",
    example: "09:00",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime?: string | null;

  @ApiProperty({
    description: "Required for PARTIAL_DAY requests, omitted for FULL_DAY.",
    example: "12:30",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime?: string | null;

  @ApiProperty({
    description: "Guardian-provided explanation for the absence.",
    example: "Family appointment.",
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;
}
