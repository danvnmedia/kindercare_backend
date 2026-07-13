import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  SCHOOL_YEAR_LIFECYCLE_COMMIT_STATUSES,
  SCHOOL_YEAR_LIFECYCLE_CONFLICT_CODES,
  SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES,
  SCHOOL_YEAR_LIFECYCLE_ERROR_CODES,
  SCHOOL_YEAR_LIFECYCLE_OPERATION_TYPES,
  SCHOOL_YEAR_LIFECYCLE_OUTCOMES,
  SCHOOL_YEAR_LIFECYCLE_PREVIEW_STATUSES,
  SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES,
  SCHOOL_YEAR_LIFECYCLE_SCOPE_TYPES,
} from "@/application/class-management/school-year-lifecycle";

export class SchoolYearLifecycleProgressCountsResponse {
  @Expose()
  @ApiProperty()
  eligible: number;

  @Expose()
  @ApiProperty()
  notStarted: number;

  @Expose()
  @ApiProperty()
  needsAction: number;

  @Expose()
  @ApiProperty()
  ready: number;

  @Expose()
  @ApiProperty()
  previewed: number;

  @Expose()
  @ApiProperty()
  skipped: number;

  @Expose()
  @ApiProperty()
  committed: number;

  @Expose()
  @ApiProperty()
  alreadyApplied: number;

  @Expose()
  @ApiProperty()
  conflict: number;

  @Expose()
  @ApiProperty()
  failed: number;

  @Expose()
  @ApiProperty()
  needsReview: number;

  @Expose()
  @ApiProperty()
  noLongerEligible: number;

  @Expose()
  @ApiProperty()
  complete: number;

  @Expose()
  @ApiProperty()
  remaining: number;

  @Expose()
  @ApiProperty()
  completionPercent: number;
}

export class SchoolYearLifecycleClassProgressResponse extends SchoolYearLifecycleProgressCountsResponse {
  @Expose()
  @ApiPropertyOptional({ nullable: true })
  classId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  className: string | null;
}

export class SchoolYearLifecycleGradeProgressResponse extends SchoolYearLifecycleProgressCountsResponse {
  @Expose()
  @ApiProperty()
  gradeLevelId: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  gradeLevelName: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  gradeLevelOrder: number | null;

  @Expose()
  @Type(() => SchoolYearLifecycleClassProgressResponse)
  @ApiProperty({ type: [SchoolYearLifecycleClassProgressResponse] })
  classes: SchoolYearLifecycleClassProgressResponse[];
}

export class SchoolYearLifecycleSchoolYearDisplayResponse {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  startDate: Date;

  @Expose()
  @ApiProperty()
  endDate: Date;
}

export class SchoolYearLifecycleRunResponse {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  campusId: string;

  @Expose()
  @ApiProperty()
  sourceSchoolYearId: string;

  @Expose()
  @ApiProperty()
  targetSchoolYearId: string;

  @Expose()
  @ApiProperty()
  sourceClosureDate: Date;

  @Expose()
  @ApiProperty()
  targetEnrollmentDate: Date;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES })
  status: string;

  @Expose()
  @ApiProperty()
  version: number;

  @Expose()
  @ApiProperty()
  createdByUserId: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  updatedByUserId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  firstCommittedAt: Date | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  cancelledAt: Date | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  expiredAt: Date | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  retentionExpiresAt: Date | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  retentionPolicySource: string | null;

  @Expose()
  @ApiProperty()
  legalHold: boolean;

  @Expose()
  @ApiProperty()
  lastActivityAt: Date;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

export class SchoolYearLifecycleRunDetailResponse {
  @Expose()
  @Type(() => SchoolYearLifecycleRunResponse)
  @ApiProperty({ type: SchoolYearLifecycleRunResponse })
  run: SchoolYearLifecycleRunResponse;

  @Expose()
  @Type(() => SchoolYearLifecycleSchoolYearDisplayResponse)
  @ApiProperty({ type: SchoolYearLifecycleSchoolYearDisplayResponse })
  sourceSchoolYear: SchoolYearLifecycleSchoolYearDisplayResponse;

  @Expose()
  @Type(() => SchoolYearLifecycleSchoolYearDisplayResponse)
  @ApiProperty({ type: SchoolYearLifecycleSchoolYearDisplayResponse })
  targetSchoolYear: SchoolYearLifecycleSchoolYearDisplayResponse;

  @Expose()
  @Type(() => SchoolYearLifecycleProgressCountsResponse)
  @ApiProperty({ type: SchoolYearLifecycleProgressCountsResponse })
  totals: SchoolYearLifecycleProgressCountsResponse;

  @Expose()
  @Type(() => SchoolYearLifecycleGradeProgressResponse)
  @ApiProperty({ type: [SchoolYearLifecycleGradeProgressResponse] })
  grades: SchoolYearLifecycleGradeProgressResponse[];
}

export class SchoolYearLifecycleCandidateResponse {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  lifecycleRunId: string;

  @Expose()
  @ApiProperty()
  studentId: string;

  @Expose()
  @ApiProperty()
  studentCode: string;

  @Expose()
  @ApiProperty()
  studentName: string;

  @Expose()
  @ApiProperty()
  sourceSchoolYearEnrollmentId: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  sourceEnrollmentId: string | null;

  @Expose()
  @ApiProperty()
  sourceGradeLevelId: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  sourceGradeLevelName: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  sourceGradeLevelOrder: number | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  sourceClassId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  sourceClassName: string | null;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES })
  status: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_OUTCOMES })
  recommendedOutcome: string;

  @Expose()
  @ApiPropertyOptional({ enum: SCHOOL_YEAR_LIFECYCLE_OUTCOMES, nullable: true })
  decision: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  targetGradeLevelId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  targetClassId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  targetClassName: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  decisionNote: string | null;

  @Expose()
  @ApiPropertyOptional({
    enum: SCHOOL_YEAR_LIFECYCLE_ERROR_CODES,
    nullable: true,
  })
  conflictCode: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  message: string | null;

  @Expose()
  @ApiProperty()
  rowVersion: number;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  decisionUpdatedByUserId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  decisionUpdatedAt: Date | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  committedAt: Date | null;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}

export class SchoolYearLifecycleProgressResponse {
  @Expose()
  @ApiProperty()
  lifecycleRunId: string;

  @Expose()
  @ApiProperty()
  version: number;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES })
  status: string;

  @Expose()
  @Type(() => SchoolYearLifecycleProgressCountsResponse)
  @ApiProperty({ type: SchoolYearLifecycleProgressCountsResponse })
  totals: SchoolYearLifecycleProgressCountsResponse;

  @Expose()
  @Type(() => SchoolYearLifecycleGradeProgressResponse)
  @ApiProperty({ type: [SchoolYearLifecycleGradeProgressResponse] })
  grades: SchoolYearLifecycleGradeProgressResponse[];
}

export class RefreshSchoolYearLifecycleCandidatesResponse {
  @Expose()
  @ApiProperty()
  addedCount: number;

  @Expose()
  @ApiProperty()
  updatedCount: number;

  @Expose()
  @ApiProperty()
  noLongerEligibleCount: number;

  @Expose()
  @Type(() => SchoolYearLifecycleRunDetailResponse)
  @ApiProperty({ type: SchoolYearLifecycleRunDetailResponse })
  run: SchoolYearLifecycleRunDetailResponse;
}

export class SchoolYearLifecycleDecisionRejectionResponse {
  @Expose()
  @ApiProperty()
  candidateId: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_ERROR_CODES })
  code: string;

  @Expose()
  @ApiProperty()
  message: string;
}

export class SchoolYearLifecycleDecisionSaveResponse {
  @Expose()
  @ApiProperty()
  lifecycleRunId: string;

  @Expose()
  @ApiProperty()
  scopeIdentity: string;

  @Expose()
  @ApiProperty()
  affectedCount: number;

  @Expose()
  @ApiProperty()
  rejectedCount: number;

  @Expose()
  @Type(() => SchoolYearLifecycleDecisionRejectionResponse)
  @ApiProperty({ type: [SchoolYearLifecycleDecisionRejectionResponse] })
  rejected: SchoolYearLifecycleDecisionRejectionResponse[];

  @Expose()
  @ApiProperty()
  version: number;
}

export class SchoolYearLifecyclePreviewSummaryResponse {
  @Expose()
  @ApiProperty()
  rowCount: number;

  @Expose()
  @ApiProperty()
  readyCount: number;

  @Expose()
  @ApiProperty()
  conflictCount: number;

  @Expose()
  @ApiProperty()
  skippedCount: number;
}

export class SchoolYearLifecycleOperationResponse {
  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_OPERATION_TYPES })
  type: string;

  @Expose()
  @ApiPropertyOptional()
  sourceId?: string;

  @Expose()
  @ApiPropertyOptional()
  targetId?: string;

  @Expose()
  @ApiPropertyOptional()
  reason?: string;
}

export class SchoolYearLifecycleRowContextResponse {
  @Expose()
  @ApiPropertyOptional({ nullable: true })
  studentName?: string | null;

  @Expose()
  @ApiPropertyOptional()
  sourceSchoolYearEnrollmentId?: string;

  @Expose()
  @ApiPropertyOptional()
  sourceClassEnrollmentId?: string;

  @Expose()
  @ApiPropertyOptional()
  sourceGradeLevelId?: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  sourceGradeLevelName?: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  sourceGradeLevelOrder?: number | null;

  @Expose()
  @ApiPropertyOptional()
  targetSchoolYearEnrollmentId?: string;

  @Expose()
  @ApiPropertyOptional()
  targetClassEnrollmentId?: string;

  @Expose()
  @ApiPropertyOptional()
  targetClassId?: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  targetClassName?: string | null;

  @Expose()
  @ApiPropertyOptional()
  targetGradeLevelId?: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  targetGradeLevelName?: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  targetGradeLevelOrder?: number | null;
}

export class SchoolYearLifecyclePreviewRowResponse {
  @Expose()
  @ApiProperty()
  studentId: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_OUTCOMES })
  outcome: string;

  @Expose()
  @ApiPropertyOptional()
  targetClassId?: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_PREVIEW_STATUSES })
  status: string;

  @Expose()
  @ApiPropertyOptional({ enum: SCHOOL_YEAR_LIFECYCLE_CONFLICT_CODES })
  conflictCode?: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_CONFLICT_CODES, isArray: true })
  conflictCodes: string[];

  @Expose()
  @Type(() => SchoolYearLifecycleOperationResponse)
  @ApiProperty({ type: [SchoolYearLifecycleOperationResponse] })
  operations: SchoolYearLifecycleOperationResponse[];

  @Expose()
  @Type(() => SchoolYearLifecycleRowContextResponse)
  @ApiProperty({ type: SchoolYearLifecycleRowContextResponse })
  context: SchoolYearLifecycleRowContextResponse;
}

export class SchoolYearLifecyclePreviewResponse {
  @Expose()
  @ApiProperty()
  previewRunId: string;

  @Expose()
  @ApiProperty()
  digest: string;

  @Expose()
  @ApiProperty()
  campusId: string;

  @Expose()
  @ApiProperty()
  sourceSchoolYearId: string;

  @Expose()
  @ApiProperty()
  targetSchoolYearId: string;

  @Expose()
  @ApiProperty()
  sourceClosureDate: Date;

  @Expose()
  @ApiProperty()
  targetEnrollmentDate: Date;

  @Expose()
  @Type(() => SchoolYearLifecyclePreviewRowResponse)
  @ApiProperty({ type: [SchoolYearLifecyclePreviewRowResponse] })
  rows: SchoolYearLifecyclePreviewRowResponse[];
}

export class RunScopedSchoolYearLifecyclePreviewResponse extends SchoolYearLifecyclePreviewResponse {
  @Expose()
  @ApiProperty()
  lifecycleRunId: string;

  @Expose()
  @ApiProperty()
  runVersion: number;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_SCOPE_TYPES.slice(1) })
  scopeType: string;

  @Expose()
  @ApiProperty()
  scopeIdentity: string;

  @Expose()
  @ApiProperty()
  expiresAt: Date;

  @Expose()
  @Type(() => SchoolYearLifecyclePreviewSummaryResponse)
  @ApiProperty({ type: SchoolYearLifecyclePreviewSummaryResponse })
  summary: SchoolYearLifecyclePreviewSummaryResponse;
}

export class SchoolYearLifecycleCommitRowResponse {
  @Expose()
  @ApiProperty()
  studentId: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_OUTCOMES })
  outcome: string;

  @Expose()
  @ApiPropertyOptional()
  targetClassId?: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_COMMIT_STATUSES })
  status: string;

  @Expose()
  @ApiPropertyOptional({ enum: SCHOOL_YEAR_LIFECYCLE_CONFLICT_CODES })
  conflictCode?: string;

  @Expose()
  @ApiPropertyOptional()
  message?: string;

  @Expose()
  @Type(() => SchoolYearLifecycleOperationResponse)
  @ApiProperty({ type: [SchoolYearLifecycleOperationResponse] })
  operations: SchoolYearLifecycleOperationResponse[];

  @Expose()
  @Type(() => SchoolYearLifecycleRowContextResponse)
  @ApiProperty({ type: SchoolYearLifecycleRowContextResponse })
  context: SchoolYearLifecycleRowContextResponse;
}

export class SchoolYearLifecycleCommitResponse {
  @Expose()
  @ApiProperty()
  previewRunId: string;

  @Expose()
  @ApiProperty()
  digest: string;

  @Expose()
  @ApiProperty()
  campusId: string;

  @Expose()
  @ApiProperty()
  sourceSchoolYearId: string;

  @Expose()
  @ApiProperty()
  targetSchoolYearId: string;

  @Expose()
  @ApiProperty()
  sourceClosureDate: Date;

  @Expose()
  @ApiProperty()
  targetEnrollmentDate: Date;

  @Expose()
  @Type(() => SchoolYearLifecycleCommitRowResponse)
  @ApiProperty({ type: [SchoolYearLifecycleCommitRowResponse] })
  rows: SchoolYearLifecycleCommitRowResponse[];
}

export class RunScopedSchoolYearLifecycleCommitResponse extends SchoolYearLifecycleCommitResponse {
  @Expose()
  @ApiProperty()
  lifecycleRunId: string;

  @Expose()
  @ApiProperty()
  commitAttemptId: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES })
  runStatus: string;

  @Expose()
  @ApiProperty()
  runVersion: number;
}

export class SchoolYearLifecyclePersistedCommitRowResponse {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  candidateId: string;

  @Expose()
  @ApiProperty()
  studentId: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_COMMIT_STATUSES })
  status: string;

  @Expose()
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_OUTCOMES })
  outcome: string;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  targetClassId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  conflictCode: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  message: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  resultingSchoolYearEnrollmentId: string | null;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  resultingClassEnrollmentId: string | null;

  @Expose()
  @Type(() => SchoolYearLifecycleOperationResponse)
  @ApiProperty({ type: [SchoolYearLifecycleOperationResponse] })
  operations: SchoolYearLifecycleOperationResponse[];

  @Expose()
  @Type(() => SchoolYearLifecycleRowContextResponse)
  @ApiProperty({ type: SchoolYearLifecycleRowContextResponse })
  context: SchoolYearLifecycleRowContextResponse;

  @Expose()
  @ApiProperty()
  createdAt: Date;
}

export class SchoolYearLifecycleCommitAttemptResponse {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  lifecycleRunId: string;

  @Expose()
  @ApiProperty()
  previewRunId: string;

  @Expose()
  @ApiProperty()
  campusId: string;

  @Expose()
  @ApiProperty()
  status: string;

  @Expose()
  @ApiProperty()
  successCount: number;

  @Expose()
  @ApiProperty()
  failedCount: number;

  @Expose()
  @ApiProperty()
  skippedCount: number;

  @Expose()
  @ApiProperty()
  alreadyAppliedCount: number;

  @Expose()
  @ApiProperty()
  createdByUserId: string;

  @Expose()
  @ApiProperty()
  startedAt: Date;

  @Expose()
  @ApiPropertyOptional({ nullable: true })
  completedAt: Date | null;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @Type(() => SchoolYearLifecyclePersistedCommitRowResponse)
  @ApiProperty({ type: [SchoolYearLifecyclePersistedCommitRowResponse] })
  rows: SchoolYearLifecyclePersistedCommitRowResponse[];
}
