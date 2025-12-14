import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class ClassTeacherClassInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp A1" })
  name: string;
}

export class ClassTeacherTeacherInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyễn Văn A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "teacher@example.com" })
  email: string;

  @Expose()
  @ApiProperty({ example: "TEACHER" })
  teacherType: string;
}

export class ClassTeacherSubjectInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Toán" })
  name: string;
}

export class ClassTeacherResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  classId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  teacherId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  subjectId: string;

  @Expose()
  @Type(() => ClassTeacherClassInfo)
  @ApiProperty({ type: ClassTeacherClassInfo, required: false })
  class?: ClassTeacherClassInfo;

  @Expose()
  @Type(() => ClassTeacherTeacherInfo)
  @ApiProperty({ type: ClassTeacherTeacherInfo, required: false })
  teacher?: ClassTeacherTeacherInfo;

  @Expose()
  @Type(() => ClassTeacherSubjectInfo)
  @ApiProperty({ type: ClassTeacherSubjectInfo, required: false })
  subject?: ClassTeacherSubjectInfo;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
