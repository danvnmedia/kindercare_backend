import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class StaffTypeResponse {
  @Expose()
  @ApiProperty({
    description: "Staff type ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Campus ID where this staff type belongs",
    example: "550e8400-e29b-41d4-a716-446655440001",
  })
  campusId: string;

  @Expose()
  @ApiProperty({
    description: "Staff type name",
    example: "Teacher",
  })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Staff type description",
    example: "Full-time teaching staff",
    nullable: true,
  })
  description: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: "Default role ID to assign to staff of this type",
    example: "550e8400-e29b-41d4-a716-446655440002",
    nullable: true,
  })
  defaultRoleId: string | null;

  @Expose()
  @ApiProperty({
    description: "Whether the staff type is archived",
    example: false,
  })
  isArchived: boolean;

  @Expose()
  @ApiProperty({
    description: "Display order of the staff type within the campus",
    example: 1,
  })
  order: number;

  @Expose()
  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}
