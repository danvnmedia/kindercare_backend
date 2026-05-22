import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateGuardianRelationshipTypeRequest {
  @ApiProperty({
    description: "Relationship type name (unique within campus)",
    example: "Father",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: "Relationship type description",
    example: "Biological or adoptive father",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: "Whether the relationship type is archived",
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
