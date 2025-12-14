import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class TeacherResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyễn Văn A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "teacher@example.com" })
  email: string;

  @Expose()
  @ApiProperty({ example: "+84912345678" })
  phoneNumber: string;

  @Expose()
  @ApiProperty({
    example: "TEACHER",
    description: "Teacher type: TEACHER, NURSE, PRINCIPAL, STAFF",
  })
  teacherType: string;

  @Expose()
  @ApiProperty({ example: "123 Đường ABC, Quận 1, TP.HCM", nullable: true })
  address: string | null;

  @Expose()
  @ApiProperty({ example: "1990-01-15T00:00:00.000Z", nullable: true })
  dateOfBirth: Date | null;

  @Expose()
  @ApiProperty({ example: "MALE", nullable: true })
  gender: string | null;

  @Expose()
  @ApiProperty({ example: "2024-01-01T00:00:00.000Z", nullable: true })
  startDate: Date | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
  })
  userId: string | null;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
