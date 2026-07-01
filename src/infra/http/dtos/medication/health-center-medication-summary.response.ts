import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class HealthCenterMedicationSummaryLinksResponse {
  @Expose()
  @ApiProperty({ example: "/health-center/medication-requests" })
  requests: string;

  @Expose()
  @ApiProperty({ example: "/health-center/medication-administration" })
  administration: string;
}

export class HealthCenterMedicationSummaryCountsResponse {
  @Expose()
  @ApiProperty({ example: 3 })
  pendingRequests: number;

  @Expose()
  @ApiProperty({ example: 8 })
  dueToday: number;

  @Expose()
  @ApiProperty({ example: 2 })
  overdue: number;

  @Expose()
  @ApiProperty({ example: 1 })
  needsMoreInfo: number;

  @Expose()
  @Type(() => HealthCenterMedicationSummaryLinksResponse)
  @ApiProperty({ type: HealthCenterMedicationSummaryLinksResponse })
  links: HealthCenterMedicationSummaryLinksResponse;
}

export class HealthCenterMedicationSummaryResponseDto {
  @Expose()
  @Type(() => HealthCenterMedicationSummaryCountsResponse)
  @ApiProperty({ type: HealthCenterMedicationSummaryCountsResponse })
  medication: HealthCenterMedicationSummaryCountsResponse;
}
