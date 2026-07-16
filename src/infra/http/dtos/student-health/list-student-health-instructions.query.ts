import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  Matches,
} from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { StudentHealthInstructionStatus } from "@/domain/student-health";

import { transformStrictBooleanQuery } from "./strict-boolean-query.transform";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class ListStudentHealthInstructionsQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "Include archived instructions in ordinary history. Omit for active-only results; only literal true or false is accepted.",
  })
  @Type(() => String)
  @Transform(({ value }) => transformStrictBooleanQuery(value))
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;

  @ApiProperty({
    enum: StudentHealthInstructionStatus,
    required: false,
    description: "Derived status filter evaluated against the reference date.",
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthInstructionStatus)
  status?: StudentHealthInstructionStatus;

  @ApiProperty({
    example: "2026-07-01",
    required: false,
    description: "Reference date for derived status calculation.",
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
