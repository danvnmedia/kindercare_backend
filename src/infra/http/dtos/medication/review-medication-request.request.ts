import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

import { MedicationReviewAction } from "@/domain/medication";

export class ReviewMedicationRequestRequest {
  @ApiProperty({
    enum: MedicationReviewAction,
    example: MedicationReviewAction.APPROVE,
  })
  @IsEnum(MedicationReviewAction)
  action: MedicationReviewAction;

  @ApiPropertyOptional({
    example: "Approved for this week.",
    nullable: true,
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;
}
