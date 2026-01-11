import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateRoleRequest {
  @ApiProperty({
    description: "Role name (unique within campus scope)",
    example: "Campus Admin",
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiPropertyOptional({
    description: "Role description",
    example: "Administrator for a specific campus",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: "Campus ID (null for system-wide roles)",
    example: "550e8400-e29b-41d4-a716-446655440000",
    nullable: true,
  })
  @IsOptional()
  @IsUUID(4)
  campusId?: string | null;

  @ApiPropertyOptional({
    description: "Whether this is a system default role (cannot be modified)",
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isSystemDefault?: boolean;

  @ApiPropertyOptional({
    description: "Permission IDs to assign to this role",
    example: ["student.create", "student.read", "student.list"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionIds?: string[];
}
