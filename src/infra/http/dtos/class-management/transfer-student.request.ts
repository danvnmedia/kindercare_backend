import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class TransferStudentRequest {
  @ApiProperty({
    description: "Target class UUID the student is being transferred into",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  toClassId: string;

  @ApiProperty({
    description:
      "Date the transfer takes effect (closes source period, opens target period). Defaults to today when omitted.",
    example: "2026-03-12",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiProperty({
    description:
      "Optional source class UUID. When provided, must match the student's active enrollment or 409 TRANSFER_SOURCE_MISMATCH.",
    example: "123e4567-e89b-12d3-a456-426614174001",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  fromClassId?: string;

  @ApiProperty({
    description: "Optional note attached to the new (target) enrollment row",
    example: "Moved due to class capacity rebalance",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
