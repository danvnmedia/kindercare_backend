import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

/**
 * Individual role assignment with optional campus context
 */
export class RoleAssignmentDto {
  @ApiProperty({
    description: "Role ID to assign",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  @IsUUID(4)
  roleId: string;

  @ApiPropertyOptional({
    description:
      "Campus ID for campus-scoped assignment. Omit or null for global assignment.",
    example: "550e8400-e29b-41d4-a716-446655440001",
    nullable: true,
  })
  @IsOptional()
  @IsUUID(4)
  campusId?: string | null;
}

/**
 * Request DTO for assigning roles to a user with campus context
 */
export class AssignRolesRequest {
  @ApiProperty({
    description: "Array of role assignments with optional campus context",
    type: [RoleAssignmentDto],
    example: [
      { roleId: "550e8400-e29b-41d4-a716-446655440000" }, // Global assignment
      {
        roleId: "550e8400-e29b-41d4-a716-446655440001",
        campusId: "550e8400-e29b-41d4-a716-446655440002",
      }, // Campus-specific
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentDto)
  roleAssignments: RoleAssignmentDto[];
}
