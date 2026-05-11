import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

export class WithdrawStudentRequest {
  @ApiProperty({
    enum: ExitReason,
    description: "Reason the enrollment period is being closed",
    example: ExitReason.WITHDRAWN,
  })
  @IsNotEmpty()
  @IsEnum(ExitReason)
  reason: ExitReason;

  @ApiProperty({
    description:
      "End date of the enrollment period (ISO date). Defaults to today if omitted. Must be on or after enrollmentDate and not in the future.",
    example: "2026-03-12",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    description: "Optional note recorded with the withdrawal",
    example: "Family relocated overseas",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
