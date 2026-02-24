import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class StudentChildInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyễn Văn A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "Bé A", nullable: true })
  nickname: string | null;
}

export class GuardianRelationshipChildInfo {
  @Expose()
  @ApiProperty({ example: "FATHER" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Cha" })
  name: string;
}

export class GuardianStudentResponse {
  @Expose()
  @Type(() => StudentChildInfo)
  @ApiProperty({ type: StudentChildInfo })
  student: StudentChildInfo;

  @Expose()
  @Type(() => GuardianRelationshipChildInfo)
  @ApiProperty({ type: GuardianRelationshipChildInfo })
  guardianRelationship: GuardianRelationshipChildInfo;

  @Expose()
  @ApiProperty({ example: "Lớp Mầm 1A", nullable: true })
  className: string | null; // This property is not mapped from the domain, will be null/undefined unless explicitly set
}

export class GuardianResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  // Personal information (now stored directly in Guardian)
  @Expose()
  @ApiProperty({ example: "Nguyễn Thị B" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "guardian@example.com", nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ example: "+84912345678" })
  phoneNumber: string;

  @Expose()
  @ApiProperty({ example: "123 Đường ABC, Quận 1, TP.HCM", nullable: true })
  address: string | null;

  @Expose()
  @ApiProperty({ example: "1985-03-20T00:00:00.000Z" })
  dateOfBirth: Date;

  @Expose()
  @ApiProperty({ example: "FEMALE", nullable: true })
  gender: string | null;

  // Guardian-specific data
  @Expose()
  @ApiProperty({ example: "Software Engineer", nullable: true })
  occupation: string | null;

  @Expose()
  @ApiProperty({ example: "456 Đường XYZ, Quận 3, TP.HCM", nullable: true })
  workAddress: string | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  campusId: string;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174002",
    nullable: true,
  })
  userId: string | null;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  // Relations
  @Expose()
  @Type(() => GuardianStudentResponse)
  @ApiProperty({ type: [GuardianStudentResponse], required: false })
  children?: GuardianStudentResponse[];

  @Expose()
  @ApiProperty({ example: "2025-11-26T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-11-26T00:00:00.000Z" })
  updatedAt: Date;
}
