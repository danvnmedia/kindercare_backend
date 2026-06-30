import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

import { AbsenceRequestStatus } from "@/domain/absence-request";

const REVIEW_STATUSES = [
  AbsenceRequestStatus.APPROVED,
  AbsenceRequestStatus.DENIED,
] as const;

export class ReviewAbsenceRequestRequest {
  @ApiProperty({
    enum: REVIEW_STATUSES,
    example: AbsenceRequestStatus.APPROVED,
  })
  @IsIn(REVIEW_STATUSES)
  status: (typeof REVIEW_STATUSES)[number];

  @ApiProperty({
    description: "Optional admin note captured with the review decision.",
    example: "Approved by office.",
    maxLength: 1000,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string | null;
}
