import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateRoleRequest {
  @ApiPropertyOptional({
    description: "Role name (unique within campus scope)",
    example: "Campus Admin",
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description: "Role description",
    example: "Administrator for a specific campus",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: "Campus ID (null to make system-wide)",
    example: "550e8400-e29b-41d4-a716-446655440000",
    nullable: true,
  })
  @IsOptional()
  @IsUUID(4)
  campusId?: string | null;
}
