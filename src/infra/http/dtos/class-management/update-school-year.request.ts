import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateSchoolYearRequest {
  @ApiPropertyOptional({
    description: "School year name",
    example: "2024-2025",
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: "Start date of the school year",
    example: "2024-09-01",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date of the school year",
    example: "2025-06-30",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Whether this school year is archived",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
