import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from "class-validator";

import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";

export class BulkAssignStaffItemRequest {
  @ApiProperty({
    description: "Staff ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  staffId: string;

  @ApiProperty({
    enum: ClassStaffRole,
    description:
      "Role for this row (HOMEROOM / ASSISTANT / BOARDING). At most one HOMEROOM per batch — payloads with two HOMEROOM rows fail whole-call with MULTIPLE_HOMEROOM_IN_BATCH.",
    example: ClassStaffRole.ASSISTANT,
  })
  @IsNotEmpty()
  @IsEnum(ClassStaffRole)
  role: ClassStaffRole;
}

export class BulkAssignStaffRequest {
  @ApiProperty({
    description:
      "Staff rows to assign. Each row carries its own role — there is no batch-level role. Capped at 100 per call.",
    type: [BulkAssignStaffItemRequest],
  })
  @IsArray()
  @ArrayMinSize(1, { message: "BATCH_EMPTY" })
  @ArrayMaxSize(100, { message: "BATCH_TOO_LARGE" })
  @ValidateNested({ each: true })
  @Type(() => BulkAssignStaffItemRequest)
  staff: BulkAssignStaffItemRequest[];
}
