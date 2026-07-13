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

  @Expose()
  @ApiProperty({ example: 1, required: false })
  order?: number;
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
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
  schoolYearEnrollmentId: string;

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
  @ApiProperty({ enum: EnrollmentEffectiveStatus })
  effectiveStatus: EnrollmentEffectiveStatus;

  @Expose()
  @ApiProperty({ nullable: true })
  cancelledAt: Date | null;

  @Expose()
  @ApiProperty({ enum: EnrollmentCancellationReason, nullable: true })
  cancellationReason: EnrollmentCancellationReason | null;

  @Expose()
  @ApiProperty({ nullable: true, maxLength: 500 })
  cancellationNote: string | null;

  @Expose()
  @Type(() => EnrollmentCancellationActorResponse)
  @ApiProperty({ type: EnrollmentCancellationActorResponse, nullable: true })
  cancelledBy: EnrollmentCancellationActorResponse | null;

  @Expose()
  @Type(() => EnrollmentHistoryClassInfo)
  @ApiProperty({ type: EnrollmentHistoryClassInfo, required: false })
  class?: EnrollmentHistoryClassInfo;

  @Expose()
  @Type(() => HistoricalSnapshotResponse)
  @ApiProperty({ type: HistoricalSnapshotResponse })
  snapshot: HistoricalSnapshotResponse;

  @Expose()
  @Type(() => HistoricalSnapshotResponse)
  @ApiProperty({ type: HistoricalSnapshotResponse })
  effectiveSnapshot: HistoricalSnapshotResponse;

  @Expose()
  @Type(() => HistoricalSnapshotAvailabilityResponse)
  @ApiProperty({ type: HistoricalSnapshotAvailabilityResponse })
  snapshotAvailability: HistoricalSnapshotAvailabilityResponse;

  @Expose()
  @Type(() => HistoricalCorrectionSummaryResponse)
  @ApiProperty({ type: HistoricalCorrectionSummaryResponse })
  correctionSummary: HistoricalCorrectionSummaryResponse;

  @Expose()
  @Type(() => HistoricalRetentionStateResponse)
  @ApiProperty({ type: HistoricalRetentionStateResponse })
  retentionState: HistoricalRetentionStateResponse;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
