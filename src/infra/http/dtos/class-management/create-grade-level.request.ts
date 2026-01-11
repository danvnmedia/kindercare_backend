import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreateGradeLevelRequest {
  @ApiProperty({
    description: "Campus ID this grade level belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  campusId: string;

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

  @ApiPropertyOptional({
    description:
      "Display order (must be non-negative). If not provided, will be auto-assigned to the next available order.",
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional({
    description: "Whether this grade level is archived",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
