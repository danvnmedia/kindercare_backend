import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

export class EligibleStaffQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    description: "Case-insensitive substring match against staff fullName",
    example: "Lan",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
