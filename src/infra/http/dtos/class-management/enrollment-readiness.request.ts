import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Matches,
  ValidateNested,
} from "class-validator";
import { EnrollmentReadinessMode } from "@/application/class-management/enrollment-readiness.types";

export class EnrollmentReadinessStudentRequest {
  @ApiProperty({
    description: "Student ID to evaluate.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiPropertyOptional({
    description:
      "Optional source class UUID for transfer readiness. When supplied, it must match the student's active class.",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsOptional()
  @IsUUID()
  fromClassId?: string;
}

export class EnrollmentReadinessRequest {
  @ApiProperty({
    enum: EnrollmentReadinessMode,
    description: "Readiness mode to evaluate before a class enrollment write.",
    example: EnrollmentReadinessMode.ENROLL,
  })
  @IsEnum(EnrollmentReadinessMode)
  mode: EnrollmentReadinessMode;

  @ApiProperty({
    description:
      "Date-only effective date to evaluate. For ENROLL this is enrollmentDate; for TRANSFER this is the transfer date that becomes the target enrollmentDate.",
    example: "2026-07-07",
  })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveDate: string;

  @ApiProperty({
    description: "Students to evaluate. Capped at 100 per call.",
    type: [EnrollmentReadinessStudentRequest],
  })
  @IsArray()
  @ArrayMinSize(1, { message: "BATCH_EMPTY" })
  @ArrayMaxSize(100, { message: "BATCH_TOO_LARGE" })
  @ValidateNested({ each: true })
  @Type(() => EnrollmentReadinessStudentRequest)
  students: EnrollmentReadinessStudentRequest[];
}
