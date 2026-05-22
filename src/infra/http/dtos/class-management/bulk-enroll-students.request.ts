import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class BulkEnrollStudentItemRequest {
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiPropertyOptional({
    description:
      "Per-row enrollment note. When set, overrides the batch-level note. When omitted, inherits the batch-level note.",
    example: "Late join",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BulkEnrollStudentsRequest {
  @ApiProperty({
    description: "Enrollment date applied to every student in the batch.",
    example: "2025-09-01",
  })
  @IsNotEmpty()
  @IsDateString()
  enrollmentDate: string;

  @ApiPropertyOptional({
    description:
      "Batch-level enrollment note applied to every row that does not provide its own note.",
    example: "Term 2 cohort",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({
    description: "Students to enroll. Capped at 100 per call.",
    type: [BulkEnrollStudentItemRequest],
  })
  @IsArray()
  @ArrayMinSize(1, { message: "BATCH_EMPTY" })
  @ArrayMaxSize(100, { message: "BATCH_TOO_LARGE" })
  @ValidateNested({ each: true })
  @Type(() => BulkEnrollStudentItemRequest)
  students: BulkEnrollStudentItemRequest[];
}
