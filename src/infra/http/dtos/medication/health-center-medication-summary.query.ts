import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, Matches } from "class-validator";

export class HealthCenterMedicationSummaryQuery {
  @ApiPropertyOptional({
    example: "2026-07-01",
    description:
      "Reference date for due-today and overdue medication administration counts.",
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
