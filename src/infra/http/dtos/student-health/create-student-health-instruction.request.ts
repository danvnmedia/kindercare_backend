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

export class CreateStudentHealthInstructionRequest {
  @ApiProperty({
    enum: StudentHealthInstructionType,
    example: StudentHealthInstructionType.MEDICATION,
  })
  @Transform(({ value }) => trimString(value))
  @IsEnum(StudentHealthInstructionType)
  instructionType: StudentHealthInstructionType;

  @ApiProperty({ example: "Antibiotic after lunch" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  title: string;

  @ApiProperty({ example: "Give the medication after lunch with water." })
  @Transform(({ value }) => trimString(value))
  @IsString()
  instruction: string;

  @ApiProperty({ example: "5 ml", required: false, nullable: true })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  dosage?: string | null;

  @ApiProperty({ example: "2026-07-01" })
  @Transform(({ value }) => trimString(value))
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @ApiProperty({ example: "2026-07-05", required: false, nullable: true })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string | null;

  @ApiProperty({
    example: ["12:30"],
    required: false,
    default: [],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, { each: true })
  timesOfDay?: string[];

  @ApiProperty({
    example: "After lunch only.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  scheduleNotes?: string | null;

  @ApiProperty({
    example: "Call guardian if vomiting occurs.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiProperty({ example: true, required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
