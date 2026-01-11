import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateStaffTypeRequest {
  @ApiProperty({
    description: "Campus ID where this staff type belongs",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsUUID(4)
  @IsNotEmpty()
  campusId: string;

  @ApiProperty({
    description: "Staff type name (unique within campus)",
    example: "Teacher",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: "Staff type description",
    example: "Full-time teaching staff",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: "Default role ID to assign to staff of this type",
    example: "550e8400-e29b-41d4-a716-446655440001",
  })
  @IsOptional()
  @IsUUID(4)
  defaultRoleId?: string;

  @ApiPropertyOptional({
    description: "Whether the staff type is active",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
