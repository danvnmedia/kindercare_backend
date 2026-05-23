import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";

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

export class ClassStaffResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  classId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  staffId: string;

  @Expose()
  @ApiProperty({
    enum: ClassStaffRole,
    example: ClassStaffRole.HOMEROOM,
    description:
      "Role assigned to the staff in this class (HOMEROOM / ASSISTANT / BOARDING).",
  })
  role: ClassStaffRole;

  @Expose()
  @Type(() => ClassStaffClassInfo)
  @ApiProperty({ type: ClassStaffClassInfo, required: false })
  class?: ClassStaffClassInfo;

  @Expose()
  @Type(() => ClassStaffStaffInfo)
  @ApiProperty({ type: ClassStaffStaffInfo, required: false })
  staff?: ClassStaffStaffInfo;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
