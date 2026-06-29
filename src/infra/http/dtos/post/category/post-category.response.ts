import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class PostCategoryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "Announcements" })
  name: string;

  @Expose()
  @ApiProperty({ example: "#FF5733", description: "Hex color code" })
  color: string;

  @Expose()
  @ApiProperty({ example: "megaphone", nullable: true })
  icon: string | null;

  @Expose()
  @ApiProperty({ example: 1 })
  order: number;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  @Expose()
  @ApiProperty({
    example: true,
    description: "Compatibility alias for !isArchived",
  })
  get isActive(): boolean {
    return !this.isArchived;
  }

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
