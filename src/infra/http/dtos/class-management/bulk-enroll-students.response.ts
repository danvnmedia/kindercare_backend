import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { EnrollmentResponse } from "./enrollment.response";

export class BulkEnrollSkippedItemResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  studentId: string;

  @Expose()
  @ApiProperty({
    description: "Stable machine code identifying why the row was skipped.",
    example: "STUDENT_ALREADY_ENROLLED",
  })
  reason: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Optional human-readable detail for clients to surface.",
  })
  message?: string;
}

export class BulkEnrollStudentsResponse {
  @Expose()
  @Type(() => EnrollmentResponse)
  @ApiProperty({ type: [EnrollmentResponse] })
  enrolled: EnrollmentResponse[];

  @Expose()
  @Type(() => BulkEnrollSkippedItemResponse)
  @ApiProperty({ type: [BulkEnrollSkippedItemResponse] })
  skipped: BulkEnrollSkippedItemResponse[];
}
