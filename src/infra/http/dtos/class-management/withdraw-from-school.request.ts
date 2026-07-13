import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

export class WithdrawFromSchoolRequest {
  @ApiProperty({
    enum: ExitReason,
    description:
      "Reason the parent enrollment is being closed. TRANSFERRED is intentionally invalid at the school-year level (use a class transfer instead — see specs/school-year-enrollment-model D2).",
    example: ExitReason.WITHDRAWN,
  })
  @IsNotEmpty()
  @IsEnum(ExitReason)
  reason: ExitReason;

  @ApiProperty({
    description:
      "Date-only exit date. Defaults to today if omitted. Must be on or after the parent enrollmentDate and not in the future.",
    example: "2026-03-12",
    required: false,
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  exitDate?: string;

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
