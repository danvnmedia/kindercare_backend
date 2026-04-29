import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

class GuardianChildRelationship {
  @Expose()
  @ApiProperty({
    description: "Relationship type ID",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Relationship type name",
    example: "Father",
  })
  name: string;
}

class GuardianChildStudent {
  @Expose()
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Student full name",
    example: "Nguyễn Văn A",
  })
  fullName: string;

  @Expose()
  @ApiProperty({
    description: "Student code",
    example: "STU-001",
    nullable: true,
  })
  studentCode: string | null;
}

export class GuardianChildResponse {
  @Expose()
  @Type(() => GuardianChildStudent)
  @ApiProperty({
    description: "Student information",
    type: GuardianChildStudent,
  })
  student: GuardianChildStudent;

  @Expose()
  @Type(() => GuardianChildRelationship)
  @ApiProperty({
    description: "Relationship type information",
    type: GuardianChildRelationship,
  })
  guardianRelationship: GuardianChildRelationship;
}
