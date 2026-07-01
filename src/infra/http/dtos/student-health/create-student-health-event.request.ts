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

export class CreateStudentHealthEventRequest {
  @ApiProperty({
    enum: StudentHealthEventType,
    example: StudentHealthEventType.ILLNESS,
  })
  @Transform(({ value }) => trimString(value))
  @IsEnum(StudentHealthEventType)
  eventType: StudentHealthEventType;

  @ApiProperty({
    enum: StudentHealthConditionCategory,
    example: StudentHealthConditionCategory.EYE,
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthConditionCategory)
  category?: StudentHealthConditionCategory | null;

  @ApiProperty({ example: "Eye redness observed" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  title: string;

  @ApiProperty({
    example: "Teacher noticed redness in the left eye after nap time.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ example: "2026-07-01T14:00:00.000Z" })
  @Transform(({ value }) => trimString(value))
  @IsDateString({ strict: true })
  occurredAt: string;

  @ApiProperty({
    enum: StudentHealthEventStatus,
    example: StudentHealthEventStatus.OPEN,
  })
  @Transform(({ value }) => trimString(value))
  @IsEnum(StudentHealthEventStatus)
  status: StudentHealthEventStatus;

  @ApiProperty({
    example: "Guardian confirmed follow-up.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  resolutionNotes?: string | null;
}
