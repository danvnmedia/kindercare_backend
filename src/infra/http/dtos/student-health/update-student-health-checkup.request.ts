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

export class UpdateStudentHealthCheckupRequest {
  @ApiProperty({
    enum: StudentHealthCheckupType,
    example: StudentHealthCheckupType.GROWTH,
    required: false,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthCheckupType)
  checkupType?: StudentHealthCheckupType;

  @ApiProperty({
    example: "2026-07-01T09:30:00.000Z",
    required: false,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsDateString()
  checkedAt?: string;

  @ApiProperty({ example: 109, required: false, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  heightCm?: number | null;

  @ApiProperty({ example: 18.8, required: false, nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  weightKg?: number | null;

  @ApiProperty({
    example: "Corrected measurement after re-check.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  notes?: string | null;
}
