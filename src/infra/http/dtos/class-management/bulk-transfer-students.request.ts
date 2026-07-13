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
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class BulkTransferStudentItemRequest {
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiPropertyOptional({
    description:
      "Optional source class UUID. When provided, must match the student's currently active enrollment or the row is skipped with reason `TRANSFER_SOURCE_MISMATCH`.",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsOptional()
  @IsUUID()
  fromClassId?: string;

  @ApiPropertyOptional({
    description:
      "Per-row transfer note. When set, overrides the batch-level note. When omitted, inherits the batch-level note. Lands on the newly-opened enrollment.",
    example: "Promoted into next grade cohort",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BulkTransferStudentsRequest {
  @ApiProperty({
    description:
      "Transfer date applied to every survivor in the batch. Closes the previous enrollment with `endDate=transferDate, exitReason=TRANSFERRED` and opens the target enrollment with `enrollmentDate=transferDate, endDate=null`.",
    example: "2026-06-30",
  })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  transferDate: string;

  @ApiPropertyOptional({
    description:
      "Batch-level note applied to every row that does not provide its own note. Lands on the newly-opened enrollment.",
    example: "End-of-term cohort promotion",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({
    description: "Students to transfer. Capped at 100 per call.",
    type: [BulkTransferStudentItemRequest],
  })
  @IsArray()
  @ArrayMinSize(1, { message: "BATCH_EMPTY" })
  @ArrayMaxSize(100, { message: "BATCH_TOO_LARGE" })
  @ValidateNested({ each: true })
  @Type(() => BulkTransferStudentItemRequest)
  students: BulkTransferStudentItemRequest[];
}
