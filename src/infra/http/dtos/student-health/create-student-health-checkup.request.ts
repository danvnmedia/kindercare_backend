import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { StudentHealthCheckupType } from "@/domain/student-health";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class CreateStudentHealthCheckupRequest {
  @ApiProperty({
    enum: StudentHealthCheckupType,
    example: StudentHealthCheckupType.GENERAL,
    required: false,
    default: StudentHealthCheckupType.GENERAL,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthCheckupType)
  checkupType?: StudentHealthCheckupType;

  @ApiProperty({ example: "2026-07-01T09:00:00.000Z" })
  @Transform(({ value }) => trimString(value))
  @IsDateString()
  checkedAt: string;

  @ApiProperty({ example: 108.5, required: false, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  heightCm?: number | null;

  @ApiProperty({ example: 18.6, required: false, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  weightKg?: number | null;

  @ApiProperty({
    example: "Routine measurement.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  notes?: string | null;
}
