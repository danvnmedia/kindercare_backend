import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateRoleRequest {
  @ApiProperty({
    description: "Role name (unique)",
    example: "ADMIN",
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  name: string;

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
    example: { users: ["create", "read", "update", "delete"], roles: ["read"] },
  })
  @IsNotEmpty()
  @IsObject()
  permissions: Record<string, any>;
}
