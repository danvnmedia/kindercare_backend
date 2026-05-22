import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

export class GetClassEnrollmentsQuery {
  @ApiPropertyOptional({
    description:
      "When true, returns all enrollment rows for the class (active + closed) ordered by enrollmentDate DESC. Defaults to false (active only).",
    example: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  includeHistorical?: boolean;
}
