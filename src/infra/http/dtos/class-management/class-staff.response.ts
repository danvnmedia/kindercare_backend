import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class ClassStaffClassInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp A1" })
  name: string;
}

export class ClassStaffStaffInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyễn Văn A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "staff@example.com" })
  email: string;

  @Expose()
  @ApiProperty({ example: "TEACHER" })
  staffType: string;
}

export class ClassStaffSubjectInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Toán" })
  name: string;
}

export class ClassStaffResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  classId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  staffId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  subjectId: string;

  @Expose()
  @Type(() => ClassStaffClassInfo)
  @ApiProperty({ type: ClassStaffClassInfo, required: false })
  class?: ClassStaffClassInfo;

  @Expose()
  @Type(() => ClassStaffStaffInfo)
  @ApiProperty({ type: ClassStaffStaffInfo, required: false })
  staff?: ClassStaffStaffInfo;

  @Expose()
  @Type(() => ClassStaffSubjectInfo)
  @ApiProperty({ type: ClassStaffSubjectInfo, required: false })
  subject?: ClassStaffSubjectInfo;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
