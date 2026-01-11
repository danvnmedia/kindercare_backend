import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateStaffTypeRequest {
  @ApiPropertyOptional({
    description: "Staff type name (unique within campus)",
    example: "Senior Teacher",
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: "Staff type description",
    example: "Senior teaching staff with mentoring responsibilities",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description: "Default role ID to assign to staff of this type",
    example: "550e8400-e29b-41d4-a716-446655440001",
    nullable: true,
  })
  @IsOptional()
  @IsUUID(4)
  defaultRoleId?: string | null;

  @ApiPropertyOptional({
    description: "Whether the staff type is active",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
