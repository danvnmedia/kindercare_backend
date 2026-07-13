import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";

import { EnrollmentEffectiveStatusFilter } from "@/application/class-management/enrollment-effective-status-filter";

export class GetClassEnrollmentsQuery {
  @ApiPropertyOptional({
    description:
      "Authoritative status at the server's current UTC date. Omission defaults to ACTIVE; ALL returns every status, including CANCELLED.",
    enum: EnrollmentEffectiveStatusFilter,
    default: EnrollmentEffectiveStatusFilter.ACTIVE,
    example: EnrollmentEffectiveStatusFilter.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EnrollmentEffectiveStatusFilter)
  effectiveStatus?: EnrollmentEffectiveStatusFilter;
}
