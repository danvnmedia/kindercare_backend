import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateGuardianRelationshipTypeRequest {
  @ApiPropertyOptional({
    description: "Relationship type name (unique within campus)",
    example: "Grandfather",
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: "Relationship type description",
    example: "Paternal or maternal grandfather",
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description: "Whether the relationship type is archived",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
