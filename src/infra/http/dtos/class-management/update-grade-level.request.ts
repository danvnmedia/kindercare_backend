import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdateGradeLevelRequest {
  @ApiPropertyOptional({
    description: "Grade level name",
    example: "Lớp Mầm",
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: "Display order (must be non-negative)",
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    description: "Whether this grade level is archived",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
