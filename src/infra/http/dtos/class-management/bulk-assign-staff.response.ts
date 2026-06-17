import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { ClassStaffResponse } from "./class-staff.response";

export class BulkAssignStaffSkippedItemResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  staffId: string;

  @Expose()
  @ApiProperty({
    description: "Stable machine code identifying why the row was skipped.",
    example: "STAFF_ALREADY_ASSIGNED",
  })
  reason: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Optional human-readable detail for clients to surface.",
  })
  message?: string;
}

export class BulkAssignStaffResponse {
  @Expose()
  @Type(() => ClassStaffResponse)
  @ApiProperty({ type: [ClassStaffResponse] })
  assigned: ClassStaffResponse[];

  @Expose()
  @Type(() => BulkAssignStaffSkippedItemResponse)
  @ApiProperty({ type: [BulkAssignStaffSkippedItemResponse] })
  skipped: BulkAssignStaffSkippedItemResponse[];
}
