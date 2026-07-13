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
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
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
  @MaxLength(16)
  icon?: string | null;

  @ApiPropertyOptional({
    description: "Display order (must be at least 1)",
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}
