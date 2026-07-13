import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class HistoricalStudentSnapshotResponse {
  @Expose()
  @ApiProperty({ nullable: true })
  fullName: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  studentCode: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  nickname: string | null;
}

export class HistoricalClassSnapshotResponse {
  @Expose()
  @ApiProperty({ nullable: true })
  name: string | null;
}

export class HistoricalGradeLevelSnapshotResponse {
  @Expose()
  @ApiProperty({ nullable: true })
  name: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  order: number | null;
}

export class HistoricalSchoolYearSnapshotResponse {
  @Expose()
  @ApiProperty({ nullable: true })
  name: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  startDate: Date | null;

  @Expose()
  @ApiProperty({ nullable: true })
  endDate: Date | null;
}

export class HistoricalSnapshotResponse {
  @Expose()
  @Type(() => HistoricalStudentSnapshotResponse)
  @ApiProperty({ type: HistoricalStudentSnapshotResponse })
  student: HistoricalStudentSnapshotResponse;

  @Expose()
  @Type(() => HistoricalClassSnapshotResponse)
  @ApiProperty({ type: HistoricalClassSnapshotResponse, nullable: true })
  class: HistoricalClassSnapshotResponse | null;

  @Expose()
  @Type(() => HistoricalGradeLevelSnapshotResponse)
  @ApiProperty({ type: HistoricalGradeLevelSnapshotResponse })
  gradeLevel: HistoricalGradeLevelSnapshotResponse;

  @Expose()
  @Type(() => HistoricalSchoolYearSnapshotResponse)
  @ApiProperty({ type: HistoricalSchoolYearSnapshotResponse })
  schoolYear: HistoricalSchoolYearSnapshotResponse;
}

export class HistoricalSnapshotAvailabilityResponse {
  @Expose()
  @ApiProperty({ enum: ["SNAPSHOT", "CURRENT_FALLBACK", "MISSING"] })
  student: "SNAPSHOT" | "CURRENT_FALLBACK" | "MISSING";

  @Expose()
  @ApiProperty({ enum: ["SNAPSHOT", "CURRENT_FALLBACK", "MISSING"] })
  class: "SNAPSHOT" | "CURRENT_FALLBACK" | "MISSING";

  @Expose()
  @ApiProperty({ enum: ["SNAPSHOT", "CURRENT_FALLBACK", "MISSING"] })
  gradeLevel: "SNAPSHOT" | "CURRENT_FALLBACK" | "MISSING";

  @Expose()
  @ApiProperty({ enum: ["SNAPSHOT", "CURRENT_FALLBACK", "MISSING"] })
  schoolYear: "SNAPSHOT" | "CURRENT_FALLBACK" | "MISSING";
}

export class HistoricalCorrectionSummaryResponse {
  @Expose()
  @ApiProperty({ example: 0 })
  appliedCount: number;

  @Expose()
  @ApiProperty({ nullable: true })
  lastCorrectedAt: Date | null;
}

export class HistoricalRetentionStateResponse {
  @Expose()
  @ApiProperty()
  archived: boolean;

  @Expose()
  @ApiProperty({ nullable: true })
  archivedAt: Date | null;

  @Expose()
  @ApiProperty()
  redacted: boolean;

  @Expose()
  @ApiProperty({ nullable: true })
  redactedAt: Date | null;

  @Expose()
  @ApiProperty({ nullable: true })
  retentionExpiresAt: Date | null;

  @Expose()
  @ApiProperty({ nullable: true })
  retentionPolicySource: string | null;

  @Expose()
  @ApiProperty()
  policyConfigured: boolean;

  @Expose()
  @ApiProperty()
  deletionEligible: boolean;

  @Expose()
  @ApiProperty()
  legalHold: boolean;
}
