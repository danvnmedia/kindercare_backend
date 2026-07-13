import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class LinkGuardianStudentRequest {
  @ApiProperty({
    description: "Student ID to link",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID("all", { message: "Student ID must be a valid UUID" })
  studentId: string;

  @ApiProperty({
    description:
      "Guardian relationship type ID (UUID from guardian-relationship-types)",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsNotEmpty()
  @IsUUID("all", { message: "Relationship ID must be a valid UUID" })
  relationshipId: string;
}
