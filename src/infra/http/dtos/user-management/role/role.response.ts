import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { PermissionResponse } from "../../rbac/permission.response";

export class RoleResponse {
  @Expose()
  @ApiProperty({
    description: "Role ID",
    example: "campus_admin",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Role name",
    example: "Campus Admin",
  })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Role description",
    example: "Administrator for a specific campus",
  })
  description: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: "Campus ID (null for system-wide roles)",
    example: "550e8400-e29b-41d4-a716-446655440000",
    nullable: true,
  })
  campusId: string | null;

  @Expose()
  @ApiProperty({
    description: "Whether this is a system default role",
    example: false,
  })
  isSystemDefault: boolean;

  @Expose()
  @Type(() => PermissionResponse)
  @ApiProperty({
    description: "Permissions assigned to this role",
    type: [PermissionResponse],
  })
  permissions: PermissionResponse[];

  @Expose()
  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-11-01T00:00:00.000Z",
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-11-01T00:00:00.000Z",
  })
  updatedAt: Date;
}
