import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class LinkStudentGuardianRequest {
  @ApiProperty({
    description: "Guardian ID to link",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsNotEmpty()
  @IsUUID("4", { message: "Guardian ID must be a valid UUID" })
  guardianId: string;

  @ApiProperty({
    description:
      "Guardian relationship type ID (UUID from guardian-relationship-types)",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsNotEmpty()
  @IsUUID("4", { message: "Relationship ID must be a valid UUID" })
  relationshipId: string;
}
