import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsOptional } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

import { transformStrictBooleanQuery } from "./strict-boolean-query.transform";

export class ListStudentHealthCheckupsQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "Include archived checkups in ordinary history. Omit for active-only results; only literal true or false is accepted.",
  })
  @Type(() => String)
  @Transform(({ value }) => transformStrictBooleanQuery(value))
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
