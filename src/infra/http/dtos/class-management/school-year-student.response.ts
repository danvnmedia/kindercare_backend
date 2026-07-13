import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import {
  SchoolYearStudentClassAssignmentState,
  SchoolYearStudentSegment,
} from "@/application/class-management/ports/school-year-enrollment.repository";
import { EnrollmentStudentInfo } from "./enrollment.response";
import {
  SchoolYearEnrollmentGradeLevelInfo,
  SchoolYearEnrollmentSchoolYearInfo,
  EnrollmentCancellationActorResponse,
} from "./school-year-enrollment.response";
import { StudentEnrollmentHistoryResponse } from "./student-enrollment-history.response";
import {
  HistoricalCorrectionSummaryResponse,
  HistoricalRetentionStateResponse,
  HistoricalSnapshotAvailabilityResponse,
  HistoricalSnapshotResponse,
} from "./historical-snapshot.response";
import { SchoolYearStudentSegmentValues } from "./school-year-student-segment";

export class SchoolYearStudentResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  schoolYearEnrollmentId: string;

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
  @ApiProperty({ enum: SchoolYearStudentSegmentValues })
  segment: SchoolYearStudentSegment;

  @Expose()
  @ApiProperty({ example: "2025-09-01T00:00:00.000Z" })
  enrollmentDate: Date;

  @Expose()
  @ApiProperty({ nullable: true })
  exitDate: Date | null;

  @Expose()
  @ApiProperty({ enum: ExitReason, nullable: true })
  exitReason: ExitReason | null;

  @Expose()
  @ApiProperty({ nullable: true })
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
  @Type(() => SchoolYearEnrollmentSchoolYearInfo)
  @ApiProperty({ type: SchoolYearEnrollmentSchoolYearInfo, nullable: true })
  schoolYear: SchoolYearEnrollmentSchoolYearInfo | null;

  @Expose()
  @Type(() => SchoolYearEnrollmentGradeLevelInfo)
  @ApiProperty({ type: SchoolYearEnrollmentGradeLevelInfo, nullable: true })
  gradeLevel: SchoolYearEnrollmentGradeLevelInfo | null;

  @Expose()
  @Type(() => EnrollmentStudentInfo)
  @ApiProperty({ type: EnrollmentStudentInfo, required: false })
  student?: EnrollmentStudentInfo;

  @Expose()
  @ApiProperty({
    example: 1,
    description:
      "Number of uncancelled class-level enrollment periods under this school-year registration.",
  })
  childEnrollmentCount: number;

  @Expose()
  @ApiProperty({
    enum: ["UPCOMING", "ACTIVE", "CLOSED", "CANCELLED", "NONE"],
  })
  classAssignmentState: SchoolYearStudentClassAssignmentState;

  @Expose()
  @Type(() => StudentEnrollmentHistoryResponse)
  @ApiProperty({ type: StudentEnrollmentHistoryResponse, nullable: true })
  classAssignment: StudentEnrollmentHistoryResponse | null;

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
  @ApiProperty({ example: "2025-09-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-09-01T00:00:00.000Z" })
  updatedAt: Date;
}
