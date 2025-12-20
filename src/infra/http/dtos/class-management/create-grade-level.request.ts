import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateGradeLevelRequest {
  @ApiProperty({
    description: "Grade level name",
    example: "Lớp Mầm",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: "Display order (must be non-negative)",
    example: 1,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  order: number;

  @ApiPropertyOptional({
    description: "Whether this grade level is archived",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
