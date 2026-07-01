import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
} from "class-validator";

import { StudentHealthInstructionType } from "@/domain/student-health";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class UpdateStudentHealthInstructionRequest {
  @ApiProperty({
    enum: StudentHealthInstructionType,
    example: StudentHealthInstructionType.CARE,
    required: false,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthInstructionType)
  instructionType?: StudentHealthInstructionType;

  @ApiProperty({ example: "Use inhaler before outdoor play", required: false })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    example: "Use the prescribed inhaler before intense activity.",
    required: false,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  instruction?: string;

  @ApiProperty({ example: "2 puffs", required: false, nullable: true })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  dosage?: string | null;

  @ApiProperty({ example: "2026-07-01", required: false })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @ApiProperty({ example: "2026-07-05", required: false, nullable: true })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string | null;

  @ApiProperty({ example: ["09:00", "15:30"], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, { each: true })
  timesOfDay?: string[];

  @ApiProperty({ example: "Before PE only.", required: false, nullable: true })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  scheduleNotes?: string | null;

  @ApiProperty({
    example: "Updated guardian note.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
