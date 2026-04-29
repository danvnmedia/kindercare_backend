import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class CampusResponse {
  @Expose()
  @ApiProperty({
    description: "Campus ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Campus name",
    example: "Main Campus",
  })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Campus address",
    example: "123 Main Street, City, Country",
    nullable: true,
  })
  address: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: "Campus phone number",
    example: "+84901234567",
    nullable: true,
  })
  phoneNumber: string | null;

  @Expose()
  @ApiProperty({
    description: "Whether the campus is archived",
    example: false,
  })
  isArchived: boolean;

  @Expose()
  @ApiProperty({
    description: "Creation timestamp",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: "Last update timestamp",
    example: "2024-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}
