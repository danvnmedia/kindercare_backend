import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from "class-validator";

import { MedicationRequestStatus } from "@/domain/medication";

export class ListMedicationRequestsQuery {
  @ApiPropertyOptional({
    description: "Authorized student UUID filter.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    enum: MedicationRequestStatus,
    example: MedicationRequestStatus.SUBMITTED,
  })
  @IsOptional()
  @IsEnum(MedicationRequestStatus)
  status?: MedicationRequestStatus;

  @ApiPropertyOptional({
    description: "Date-only lower bound for request date range overlap.",
    example: "2026-07-01",
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({
    description: "Date-only upper bound for request date range overlap.",
    example: "2026-07-31",
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}
