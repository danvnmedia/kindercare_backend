import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsOptional, Matches } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { StudentHealthInstructionStatus } from "@/domain/student-health";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class ListStudentHealthInstructionsQuery extends StandardRequestDto {
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
