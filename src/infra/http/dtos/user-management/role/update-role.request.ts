import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateRoleRequest {
  @ApiProperty({
    description: "Role name (unique)",
    example: "ADMIN",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiProperty({
    description: "Role description",
    example: "Administrator with full access",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({
    description: "Permissions object",
    example: { users: ["create", "read", "update", "delete"] },
    required: false,
  })
  @IsOptional()
  @IsObject()
  permissions?: Record<string, any>;

  @ApiProperty({
    description: "Role active status",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
