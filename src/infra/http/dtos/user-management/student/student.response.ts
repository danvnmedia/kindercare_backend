import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { STUDENT_PHASES } from "@/domain/user-management/enums/student-phase.enum";
import { ClassSummaryDto } from "../../class-management/class-summary.dto";

export class GuardianInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyễn Thị B" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "MOTHER" })
  relationship: string;

  @Expose()
  @ApiProperty({ example: "guardian@example.com", nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ example: "+84912345678", nullable: true })
  phoneNumber: string | null;
}

export class StudentResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "Campus ID where the student is enrolled",
  })
  campusId: string;

  @Expose()
  @ApiProperty({
    example: "2025-000001",
    description:
      "Auto-generated student code in format YYYY-XXXXXX (unique per campus)",
  })
  studentCode: string;

  // Personal information (now stored directly in Student)
  @Expose()
  @ApiProperty({ example: "Nguyễn Văn A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "student@example.com", nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ example: "+84912345678", nullable: true })
  phoneNumber: string | null;

  @Expose()
  @ApiProperty({ example: "123 Đường ABC, Quận 1, TP.HCM", nullable: true })
  address: string | null;

  @Expose()
  @ApiProperty({ example: "2018-05-15T00:00:00.000Z", nullable: true })
  dateOfBirth: Date | null;

  // Student-specific data
  @Expose()
  @ApiProperty({ example: "Bé A", nullable: true })
  nickname: string | null;

  @Expose()
  @ApiProperty({ example: "MALE", nullable: true })
  gender: string | null;

  @Expose()
  @ApiProperty({
    enum: STUDENT_PHASES,
    example: "ACTIVE",
    nullable: true,
    description:
      "Derived lifecycle phase computed from Enrollment + SchoolYearEnrollment state. " +
      "One of ACTIVE, WAITING, DEFERRED, COMPLETED, GRADUATED, WITHDRAWN. " +
      "May be null on responses to write endpoints (POST/PATCH) that read back from the base table; " +
      "GET endpoints project phase from the student_with_phase view.",
  })
  phase: string | null;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  // Relations
  @Expose()
  @Type(() => ClassSummaryDto)
  @ApiProperty({
    type: ClassSummaryDto,
    nullable: true,
    description:
      "Snapshot of the student's currently-open enrollment's class " +
      "({ id, name }) projected from the student_with_phase view. " +
      "Null when the student has no open enrollment. " +
      "May also be null on responses to write endpoints (POST/PATCH) that " +
      "read back from the base table; GET endpoints project currentClass " +
      "from the student_with_phase view (parallel to the `phase` contract).",
  })
  currentClass: ClassSummaryDto | null;

  @Expose()
  @Type(() => GuardianInfo)
  @ApiProperty({ type: [GuardianInfo], required: false })
  guardians?: GuardianInfo[];

  @Expose()
  @ApiProperty({ example: "2025-11-26T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-11-26T00:00:00.000Z" })
  updatedAt: Date;
}
