import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class GuardianRelationshipTypeResponse {
  @Expose()
  @ApiProperty({
    description: "Guardian relationship type ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Campus ID where this relationship type belongs",
    example: "550e8400-e29b-41d4-a716-446655440001",
  })
  campusId: string;

  @Expose()
  @ApiProperty({
    description: "Relationship type name",
    example: "Father",
  })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Relationship type description",
    example: "Biological or adoptive father",
    nullable: true,
  })
  description: string | null;

  @Expose()
  @ApiProperty({
    description: "Whether the relationship type is archived",
    example: false,
  })
  isArchived: boolean;

  @Expose()
  @ApiProperty({
    description: "Display order within the campus",
    example: 1,
  })
  order: number;

  @Expose()
  @ApiProperty({
    description: "Creation timestamp",
    example: "2026-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: "Last update timestamp",
    example: "2026-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}
