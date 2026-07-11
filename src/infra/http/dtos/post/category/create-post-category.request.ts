import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class CreatePostCategoryRequest {
  @ApiProperty({
    description: "Category name",
    example: "Announcements",
    minLength: 1,
    maxLength: 60,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @ApiProperty({
    description: "Hex color code (e.g., #FF5733)",
    example: "#FF5733",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: "Color must be a valid hex color (e.g., #FF5733)",
  })
  color: string;

  @ApiPropertyOptional({
    description: "Icon identifier",
    example: "megaphone",
  })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;

  @ApiPropertyOptional({
    description:
      "Display order (must be at least 1). If not provided, will be auto-assigned to the next available order.",
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;
}
