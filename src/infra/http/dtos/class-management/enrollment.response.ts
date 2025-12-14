import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class EnrollmentStudentInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyễn Văn A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "Bé A", nullable: true })
  nickname: string | null;

  @Expose()
  @ApiProperty({ example: "STU001", nullable: true })
  studentCode: string | null;
}

export class EnrollmentClassInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp A1" })
  name: string;
}

export class EnrollmentResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  classId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  studentId: string;

  @Expose()
  @ApiProperty({ example: "2024-09-01T00:00:00.000Z" })
  enrollmentDate: Date;

  @Expose()
  @ApiProperty({ example: "Enrolled at start of school year", nullable: true })
  note: string | null;

  @Expose()
  @Type(() => EnrollmentClassInfo)
  @ApiProperty({ type: EnrollmentClassInfo, required: false })
  class?: EnrollmentClassInfo;

  @Expose()
  @Type(() => EnrollmentStudentInfo)
  @ApiProperty({ type: EnrollmentStudentInfo, required: false })
  student?: EnrollmentStudentInfo;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
