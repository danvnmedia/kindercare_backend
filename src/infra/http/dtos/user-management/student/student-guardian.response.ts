import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class StudentGuardianResponse {
  @Expose()
  @ApiProperty({
    description: "Guardian ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  guardianId: string;

  @Expose()
  @ApiProperty({
    description: "Guardian full name",
    example: "Nguyễn Văn B",
  })
  fullName: string;

  @Expose()
  @ApiProperty({
    description: "Guardian email",
    example: "guardian@example.com",
    nullable: true,
  })
  email: string | null;

  @Expose()
  @ApiProperty({
    description: "Guardian phone number",
    example: "+84912345678",
    nullable: true,
  })
  phoneNumber: string | null;

  @Expose()
  @ApiProperty({
    description: "Relationship type ID",
    example: "FATHER",
  })
  relationship: string;

  @Expose()
  @ApiProperty({
    description: "Relationship type name (localized)",
    example: "Bố",
  })
  relationshipName: string;
}

export class LinkStudentGuardianResponse {
  @Expose()
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  studentId: string;

  @Expose()
  @ApiProperty({
    description: "Guardian ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  guardianId: string;

  @Expose()
  @ApiProperty({
    description: "Relationship type ID",
    example: "FATHER",
  })
  relationshipId: string;

  @Expose()
  @ApiProperty({
    description: "Relationship type name",
    example: "Father",
  })
  relationshipName: string;
}
