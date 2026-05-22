import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

export class EligibleStudentsQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    description: "Case-insensitive substring match against student fullName",
    example: "Anh",
  })
  @IsOptional()
  @IsString()
  search?: string;
}
