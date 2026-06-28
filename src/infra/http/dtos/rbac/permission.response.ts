import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class PermissionResponse {
  @Expose()
  @ApiProperty({
    description: "Permission ID in format module.action",
    example: "student.create",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Module name",
    example: "student",
  })
  module: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Permission description",
    example: "Create a new student",
  })
  description: string | null;

  @Expose()
  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-11-01T00:00:00.000Z",
  })
  createdAt: Date;
}
