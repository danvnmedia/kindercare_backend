import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class UpdateStudentGuardianRequest {
  @ApiProperty({
    description:
      "Guardian relationship type ID (UUID from guardian-relationship-types)",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsNotEmpty()
  @IsUUID("4", { message: "Relationship ID must be a valid UUID" })
  relationshipId: string;
}
