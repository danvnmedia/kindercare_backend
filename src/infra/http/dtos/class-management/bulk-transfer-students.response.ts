import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { TransferStudentResponse } from "./transfer-student.response";

export class BulkTransferSkippedItemResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  studentId: string;

  @Expose()
  @ApiProperty({
    description: "Stable machine code identifying why the row was skipped.",
    example: "NO_ACTIVE_ENROLLMENT",
  })
  reason: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Optional human-readable detail for clients to surface.",
  })
  message?: string;
}

export class BulkTransferStudentsResponse {
  @Expose()
  @Type(() => TransferStudentResponse)
  @ApiProperty({
    type: [TransferStudentResponse],
    description:
      "Per-row close+open pairs for every survivor. Each pair was persisted in its own DB transaction.",
  })
  transferred: TransferStudentResponse[];

  @Expose()
  @Type(() => BulkTransferSkippedItemResponse)
  @ApiProperty({
    type: [BulkTransferSkippedItemResponse],
    description:
      "Rows that did not transfer (per-row validation failure or row-level DB error). Other rows in the batch still persist.",
  })
  skipped: BulkTransferSkippedItemResponse[];
}
