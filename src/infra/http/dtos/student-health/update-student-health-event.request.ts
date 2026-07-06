import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

import {
  StudentHealthConditionCategory,
  StudentHealthEventStatus,
  StudentHealthEventType,
} from "@/domain/student-health";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class UpdateStudentHealthEventRequest {
  @ApiProperty({
    enum: StudentHealthEventType,
    example: StudentHealthEventType.OBSERVATION,
    required: false,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthEventType)
  eventType?: StudentHealthEventType;

  @ApiProperty({
    enum: StudentHealthConditionCategory,
    example: StudentHealthConditionCategory.RESPIRATORY,
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthConditionCategory)
  category?: StudentHealthConditionCategory | null;

  @ApiProperty({ example: "Cough observed", required: false })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    example: "Teacher observed a mild cough after outdoor play.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({
    example: "2026-07-01T14:00:00.000Z",
    required: false,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsDateString({ strict: true })
  occurredAt?: string;

  @ApiProperty({
    enum: StudentHealthEventStatus,
    example: StudentHealthEventStatus.RESOLVED,
    required: false,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthEventStatus)
  status?: StudentHealthEventStatus;

  @ApiProperty({
    example: "Guardian picked up student and confirmed follow-up.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  resolutionNotes?: string | null;
}
