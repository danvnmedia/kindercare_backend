import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";

export class UpdateCampusRequest {
  @ApiPropertyOptional({
    description: "Campus name",
    example: "Main Campus",
    minLength: 1,
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: "Campus address",
    example: "123 Main Street, City, Country",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({
    description: "Campus phone number in E.164 format",
    example: "+84901234567",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: "Phone number must be in E.164 format (e.g., +84901234567)",
  })
  phoneNumber?: string | null;

  @ApiPropertyOptional({
    description: "Whether the campus is archived",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
