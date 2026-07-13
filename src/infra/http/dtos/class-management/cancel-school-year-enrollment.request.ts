import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";

export class CancelSchoolYearEnrollmentRequest {
  @ApiProperty({
    enum: EnrollmentCancellationReason,
    example: EnrollmentCancellationReason.FAMILY_REQUEST,
    description: "Required reason for cancelling the upcoming registration.",
  })
  @IsNotEmpty()
  @IsEnum(EnrollmentCancellationReason)
  cancellationReason: EnrollmentCancellationReason;

  @ApiProperty({
    required: false,
    maxLength: 500,
    example: "Family plans changed before the school year started",
    description:
      "Optional note. Leading and trailing whitespace is removed; an empty value is stored as null.",
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  note?: string;
}
