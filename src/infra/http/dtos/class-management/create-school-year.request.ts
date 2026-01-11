import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateSchoolYearRequest {
  @ApiProperty({
    description: "Campus ID this school year belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  campusId: string;

  @ApiProperty({
    description: "School year name",
    example: "2024-2025",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: "Start date of the school year",
    example: "2024-09-01",
  })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: "End date of the school year",
    example: "2025-06-30",
  })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: "Whether this school year is archived",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
