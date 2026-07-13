import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import { EnrollmentCancellationActorResponse } from "./school-year-enrollment.response";
import {
  HistoricalCorrectionSummaryResponse,
  HistoricalRetentionStateResponse,
  HistoricalSnapshotAvailabilityResponse,
  HistoricalSnapshotResponse,
} from "./historical-snapshot.response";

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

export class EnrollmentSchoolYearInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
  id: string;

  @Expose()
  @ApiProperty({ example: "2025-2026" })
  name: string;
}

export class EnrollmentGradeLevelInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174004" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Mầm" })
  name: string;

  @Expose()
  @ApiProperty({ example: 1 })
  order: number;
}

export class EnrollmentClassInfo {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp A1" })
  name: string;

  @Expose()
  @Type(() => EnrollmentSchoolYearInfo)
  @ApiProperty({ type: () => EnrollmentSchoolYearInfo, required: false })
  schoolYear?: EnrollmentSchoolYearInfo | null;

  @Expose()
  @Type(() => EnrollmentGradeLevelInfo)
  @ApiProperty({ type: () => EnrollmentGradeLevelInfo, required: false })
  gradeLevel?: EnrollmentGradeLevelInfo | null;
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
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174003",
    required: false,
  })
  schoolYearEnrollmentId?: string;

  @Expose()
  @ApiProperty({ example: "2024-09-01T00:00:00.000Z" })
  enrollmentDate: Date;

  @Expose()
  @ApiProperty({
    example: "2026-03-12T00:00:00.000Z",
    nullable: true,
    description: "Date the enrollment period was closed; null if still active",
  })
  endDate: Date | null;

  @Expose()
  @ApiProperty({
    enum: ExitReason,
    example: ExitReason.WITHDRAWN,
    nullable: true,
    description:
      "Reason the enrollment was closed; null if still active. Always set together with endDate.",
  })
  exitReason: ExitReason | null;

  @Expose()
  @ApiProperty({ example: "Enrolled at start of school year", nullable: true })
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
  @Type(() => EnrollmentClassInfo)
  @ApiProperty({ type: EnrollmentClassInfo, required: false })
  class?: EnrollmentClassInfo;

  @Expose()
  @Type(() => EnrollmentStudentInfo)
  @ApiProperty({ type: EnrollmentStudentInfo, required: false })
  student?: EnrollmentStudentInfo;

  @Expose()
  @Type(() => HistoricalSnapshotResponse)
  @ApiProperty({ type: HistoricalSnapshotResponse, required: false })
  snapshot?: HistoricalSnapshotResponse;

  @Expose()
  @Type(() => HistoricalSnapshotResponse)
  @ApiProperty({ type: HistoricalSnapshotResponse, required: false })
  effectiveSnapshot?: HistoricalSnapshotResponse;

  @Expose()
  @Type(() => HistoricalSnapshotAvailabilityResponse)
  @ApiProperty({
    type: HistoricalSnapshotAvailabilityResponse,
    required: false,
  })
  snapshotAvailability?: HistoricalSnapshotAvailabilityResponse;

  @Expose()
  @Type(() => HistoricalCorrectionSummaryResponse)
  @ApiProperty({ type: HistoricalCorrectionSummaryResponse, required: false })
  correctionSummary?: HistoricalCorrectionSummaryResponse;

  @Expose()
  @Type(() => HistoricalRetentionStateResponse)
  @ApiProperty({ type: HistoricalRetentionStateResponse, required: false })
  retentionState?: HistoricalRetentionStateResponse;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
