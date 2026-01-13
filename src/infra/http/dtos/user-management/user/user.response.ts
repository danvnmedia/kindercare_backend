import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { RoleResponse } from "../role/role.response";

/**
 * Role assignment response with campus context
 */
export class UserRoleAssignmentResponse {
  @Expose()
  @Type(() => RoleResponse)
  @ApiProperty({
    type: RoleResponse,
    description: "The assigned role",
  })
  role: RoleResponse;

  @Expose()
  @ApiPropertyOptional({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "Campus ID for this assignment (null for global assignment)",
    nullable: true,
  })
  campusId: string | null;

  @Expose()
  @ApiProperty({
    example: "2025-11-01T00:00:00.000Z",
    description: "When the role was assigned",
  })
  assignedAt: Date;
}

export class UserResponse {
  @Expose()
  @ApiProperty({
    example: "550e8400-e29b-41d4-a716-446655440000",
    description: "User ID (UUID)",
  })
  id: string;

  @Expose()
  @ApiProperty({
    example: "user_2abc123def456",
    description: "Clerk authentication UID",
  })
  clerkUid: string;

  @Expose()
  @ApiProperty({
    example: true,
    description: "Whether the user account is active",
  })
  isActive: boolean;

  @Expose()
  @Type(() => UserRoleAssignmentResponse)
  @ApiProperty({
    type: [UserRoleAssignmentResponse],
    required: false,
    description: "User role assignments with campus context",
  })
  roleAssignments?: UserRoleAssignmentResponse[];

  @Expose()
  @ApiProperty({ example: "2025-11-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-11-01T00:00:00.000Z" })
  updatedAt: Date;
}
