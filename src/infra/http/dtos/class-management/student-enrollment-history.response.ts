import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

export class EnrollmentHistorySchoolYearInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "2024-2025" })
  name: string;
}

export class EnrollmentHistoryGradeLevelInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Mầm" })
  name: string;
}

export class EnrollmentHistoryClassInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp A1" })
  name: string;

  @Expose()
  @Type(() => EnrollmentHistorySchoolYearInfo)
  @ApiProperty({ type: EnrollmentHistorySchoolYearInfo, required: false })
  schoolYear?: EnrollmentHistorySchoolYearInfo;

  @Expose()
  @Type(() => EnrollmentHistoryGradeLevelInfo)
  @ApiProperty({ type: EnrollmentHistoryGradeLevelInfo, required: false })
  gradeLevel?: EnrollmentHistoryGradeLevelInfo;
}

export class StudentEnrollmentHistoryResponse {
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
  @ApiProperty({
    example: "2025-01-31T00:00:00.000Z",
    nullable: true,
    description: "Date the enrollment period was closed; null if still active",
  })
  endDate: Date | null;

  @Expose()
  @ApiProperty({
    enum: ExitReason,
    example: ExitReason.TRANSFERRED,
    nullable: true,
    description:
      "Reason the enrollment was closed; null if still active. Always set together with endDate.",
  })
  exitReason: ExitReason | null;

  @Expose()
  @ApiProperty({ example: "Initial enrollment", nullable: true })
  note: string | null;

  @Expose()
  @Type(() => EnrollmentHistoryClassInfo)
  @ApiProperty({ type: EnrollmentHistoryClassInfo, required: false })
  class?: EnrollmentHistoryClassInfo;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
