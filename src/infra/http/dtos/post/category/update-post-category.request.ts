import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class UpdatePostCategoryRequest {
  @ApiPropertyOptional({
    description: "Category name",
    example: "Announcements",
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: "Hex color code (e.g., #FF5733)",
    example: "#FF5733",
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: "Color must be a valid hex color (e.g., #FF5733)",
  })
  color?: string;

  @ApiPropertyOptional({
    description: "Icon identifier (set to null to remove)",
    example: "megaphone",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  icon?: string | null;

  @ApiPropertyOptional({
    description: "Display order (must be non-negative)",
    example: 1,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
