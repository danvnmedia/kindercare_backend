import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, Matches } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { MedicationRequestStatus } from "@/domain/medication";

export class ListStudentMedicationHistoryQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    enum: MedicationRequestStatus,
    example: MedicationRequestStatus.APPROVED,
  })
  @IsOptional()
  @IsEnum(MedicationRequestStatus)
  status?: MedicationRequestStatus;

  @ApiPropertyOptional({ example: "2026-07-01" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ example: "2026-07-31" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}
