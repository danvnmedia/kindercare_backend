import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { AbsenceRequestStatus } from "@/domain/absence-request";

export class ListAbsenceRequestsQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    enum: AbsenceRequestStatus,
    description: "Convenience status filter for common admin views.",
  })
  @IsOptional()
  @IsEnum(AbsenceRequestStatus)
  status?: AbsenceRequestStatus;

  @ApiPropertyOptional({
    description:
      "Returns absence requests whose start/end date range contains this date.",
    example: "2026-07-10",
  })
  @IsOptional()
  @IsDateString()
  overlapsDate?: string;
}
