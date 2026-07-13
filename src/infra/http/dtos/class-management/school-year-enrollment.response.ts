import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";

export class EnrollmentCancellationActorResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyen Van Admin", nullable: true })
  fullName: string | null;
}

export class SchoolYearEnrollmentSchoolYearInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Năm học 2025-2026" })
  name: string;

  @Expose()
  @ApiProperty({ example: "2025-09-01T00:00:00.000Z" })
  startDate: Date;

  @Expose()
  @ApiProperty({ example: "2026-06-30T00:00:00.000Z" })
  endDate: Date;
}

export class SchoolYearEnrollmentGradeLevelInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp Mầm" })
  name: string;

  @Expose()
  @ApiProperty({ example: 1 })
  order: number;
}

export class SchoolYearEnrollmentResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  studentId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
  schoolYearId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174004" })
  gradeLevelId: string;

  @Expose()
  @ApiProperty({ example: "2025-09-01T00:00:00.000Z" })
  enrollmentDate: Date;

  @Expose()
  @ApiProperty({
    example: null,
    nullable: true,
    description:
      "Date the parent enrollment period was closed; null while active.",
  })
  exitDate: Date | null;

  @Expose()
  @ApiProperty({
    enum: ExitReason,
    example: null,
    nullable: true,
    description:
      "Reason the parent enrollment was closed; null while active. Always set together with exitDate.",
  })
  exitReason: ExitReason | null;

  @Expose()
  @ApiProperty({
    example: "Late registration approved by principal",
    nullable: true,
  })
  note: string | null;

  @Expose()
  @ApiProperty({ enum: EnrollmentEffectiveStatus })
  effectiveStatus: EnrollmentEffectiveStatus;

  @Expose()
  @ApiProperty({ nullable: true, example: "2026-07-11T16:30:00.000Z" })
  cancelledAt: Date | null;

  @Expose()
  @ApiProperty({
    enum: EnrollmentCancellationReason,
    nullable: true,
    example: EnrollmentCancellationReason.FAMILY_REQUEST,
  })
  cancellationReason: EnrollmentCancellationReason | null;

  @Expose()
  @ApiProperty({ nullable: true, maxLength: 500 })
  cancellationNote: string | null;

  @Expose()
  @Type(() => EnrollmentCancellationActorResponse)
  @ApiProperty({ type: EnrollmentCancellationActorResponse, nullable: true })
  cancelledBy: EnrollmentCancellationActorResponse | null;

  @Expose()
  @Type(() => SchoolYearEnrollmentSchoolYearInfo)
  @ApiProperty({
    type: SchoolYearEnrollmentSchoolYearInfo,
    required: false,
  })
  schoolYear?: SchoolYearEnrollmentSchoolYearInfo;

  @Expose()
  @Type(() => SchoolYearEnrollmentGradeLevelInfo)
  @ApiProperty({
    type: SchoolYearEnrollmentGradeLevelInfo,
    required: false,
  })
  gradeLevel?: SchoolYearEnrollmentGradeLevelInfo;

  @Expose()
  @ApiProperty({ example: "2025-09-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-09-01T00:00:00.000Z" })
  updatedAt: Date;
}
