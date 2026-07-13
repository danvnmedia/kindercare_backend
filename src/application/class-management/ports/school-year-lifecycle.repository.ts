import {
  SchoolYearLifecycleCandidate,
  SchoolYearLifecycleCandidateAggregate,
  SchoolYearLifecycleCandidateListQuery,
  SchoolYearLifecycleCandidatePage,
  SchoolYearLifecycleCandidateFilter,
  SchoolYearLifecycleCandidateStatus,
  SchoolYearLifecycleOutcome,
  SchoolYearLifecycleCommitAttemptResult,
  SchoolYearLifecycleCommitRowResult,
  SchoolYearLifecyclePreviewRunStatus,
  SchoolYearLifecycleRun,
  SchoolYearLifecycleRunStatus,
  SchoolYearLifecycleScopeType,
} from "@/application/class-management/school-year-lifecycle";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { AuditEventInput } from "@/application/audit/ports/audit-event-recorder.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";

export interface SchoolYearLifecycleSourceCandidate {
  schoolYearEnrollment: SchoolYearEnrollment;
  activeEnrollment: Enrollment | null;
}

export interface SchoolYearLifecyclePreviewRun {
  id: string;
  lifecycleRunId: string | null;
  runVersion: number | null;
  campusId: string;
  sourceSchoolYearId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  digest: string;
  requestPayload: unknown;
  resultPayload: unknown;
  scopeType: SchoolYearLifecycleScopeType;
  scopeIdentity: string | null;
  scopePayload: unknown | null;
  status: SchoolYearLifecyclePreviewRunStatus;
  expiresAt: Date;
  invalidatedAt: Date | null;
  supersededAt: Date | null;
  finalizedAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSchoolYearLifecycleRunInput {
  id?: string;
  campusId: string;
  sourceSchoolYearId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  createdByUserId: string;
  audit?: AuditEventInput;
}

export interface SchoolYearLifecycleRetentionInput {
  retentionExpiresAt: Date;
  retentionPolicySource: string;
}

export interface FindOrCreateSchoolYearLifecycleRunResult {
  run: SchoolYearLifecycleRun;
  created: boolean;
}

export interface UpdateSchoolYearLifecycleRunVersionedInput {
  id: string;
  campusId: string;
  expectedVersion: number;
  updatedByUserId: string;
  targetSchoolYearId?: string;
  sourceClosureDate?: Date;
  targetEnrollmentDate?: Date;
  status?: SchoolYearLifecycleRunStatus;
  firstCommittedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  expiredAt?: Date;
  lastActivityAt?: Date;
  invalidatePreviews?: boolean;
  resetTargetAssignments?: boolean;
  retention?: SchoolYearLifecycleRetentionInput;
  audit?: AuditEventInput;
}

export interface SaveSchoolYearLifecyclePreviewRunInput {
  id?: string;
  lifecycleRunId?: string;
  runVersion?: number;
  campusId: string;
  sourceSchoolYearId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  digest: string;
  requestPayload: unknown;
  resultPayload: unknown;
  scopeType?: SchoolYearLifecycleScopeType;
  scopeIdentity?: string;
  scopePayload?: unknown;
  status?: SchoolYearLifecyclePreviewRunStatus;
  expiresAt?: Date;
  createdByUserId: string;
}

export interface SaveRunScopedSchoolYearLifecyclePreviewInput
  extends SaveSchoolYearLifecyclePreviewRunInput {
  lifecycleRunId: string;
  runVersion: number;
  scopeType: Exclude<SchoolYearLifecycleScopeType, "LEGACY">;
  scopeIdentity: string;
  expiresAt: Date;
  candidates: Array<{
    candidateId: string;
    sequence: number;
    normalizedRow: unknown;
    status: SchoolYearLifecycleCandidateStatus;
    conflictCode: string | null;
    message: string | null;
  }>;
  audit?: AuditEventInput;
}

export interface SaveRunScopedSchoolYearLifecyclePreviewResult {
  previewRun: SchoolYearLifecyclePreviewRun;
  supersededPreviewIds: string[];
}

export interface SchoolYearLifecyclePreviewMembership {
  candidateId: string;
  studentId: string;
  sequence: number;
  normalizedRow: unknown;
}

export interface FinalizeSchoolYearLifecycleCommitAttemptInput {
  commitAttemptId: string;
  lifecycleRunId: string;
  previewRunId: string;
  campusId: string;
  rows: Array<{
    candidateId: string;
    result: SchoolYearLifecycleCommitRowResult;
  }>;
  retention?: SchoolYearLifecycleRetentionInput;
}

export interface SaveSchoolYearLifecycleCandidateInput {
  id?: string;
  lifecycleRunId: string;
  campusId: string;
  studentId: string;
  sourceSchoolYearEnrollmentId: string;
  sourceEnrollmentId: string | null;
  sourceGradeLevelId: string;
  sourceClassId: string | null;
  recommendedOutcome: SchoolYearLifecycleCandidate["recommendedOutcome"];
  status?: SchoolYearLifecycleCandidate["status"];
  decision?: SchoolYearLifecycleCandidate["decision"];
  targetGradeLevelId?: string | null;
}

export interface ReconcileSchoolYearLifecycleCandidateInput {
  id: string;
  sourceSchoolYearEnrollmentId: string;
  sourceEnrollmentId: string | null;
  sourceGradeLevelId: string;
  sourceClassId: string | null;
  status: SchoolYearLifecycleCandidateStatus;
  recommendedOutcome: SchoolYearLifecycleOutcome;
  decision: SchoolYearLifecycleOutcome | null;
  targetGradeLevelId: string | null;
  targetClassId: string | null;
}

export interface ReconcileSchoolYearLifecycleCandidatesVersionedInput {
  lifecycleRunId: string;
  campusId: string;
  expectedVersion: number;
  updatedByUserId: string;
  inserts: SaveSchoolYearLifecycleCandidateInput[];
  updates: ReconcileSchoolYearLifecycleCandidateInput[];
  audit?: AuditEventInput;
}

export interface SaveSchoolYearLifecycleDecisionMutation {
  candidateId: string;
  decision: SchoolYearLifecycleOutcome;
  targetGradeLevelId: string | null;
  targetClassId: string | null;
  decisionNote: string | null;
  status: SchoolYearLifecycleCandidateStatus;
}

export interface SaveSchoolYearLifecycleDecisionsVersionedInput {
  lifecycleRunId: string;
  campusId: string;
  expectedVersion: number;
  updatedByUserId: string;
  decisions: SaveSchoolYearLifecycleDecisionMutation[];
  audit?: AuditEventInput;
}

export interface ExpireInactiveSchoolYearLifecycleRunInput {
  lifecycleRunId: string;
  campusId: string;
  expectedVersion: number;
  inactiveBefore: Date;
  expiredAt: Date;
  retention?: SchoolYearLifecycleRetentionInput;
  audit: AuditEventInput;
}

export abstract class SchoolYearLifecycleRepository {
  abstract findActiveRun(
    campusId: string,
    sourceSchoolYearId: string,
  ): Promise<SchoolYearLifecycleRun | null>;

  abstract findRunById(
    id: string,
    campusId: string,
  ): Promise<SchoolYearLifecycleRun | null>;

  abstract findInactiveUncommittedRuns(
    inactiveBefore: Date,
    limit: number,
  ): Promise<SchoolYearLifecycleRun[]>;

  abstract expireInactiveRun(
    input: ExpireInactiveSchoolYearLifecycleRunInput,
  ): Promise<SchoolYearLifecycleRun | null>;

  abstract findOrCreateRun(
    input: CreateSchoolYearLifecycleRunInput,
    initialCandidates?: SaveSchoolYearLifecycleCandidateInput[],
  ): Promise<FindOrCreateSchoolYearLifecycleRunResult>;

  /**
   * Applies a run mutation only when the campus-scoped version matches.
   * Returns null after a stale write and never applies a partial patch.
   */
  abstract updateRunVersioned(
    input: UpdateSchoolYearLifecycleRunVersionedInput,
  ): Promise<SchoolYearLifecycleRun | null>;

  abstract saveInitialCandidates(
    inputs: SaveSchoolYearLifecycleCandidateInput[],
    tx?: AppTransactionClient,
  ): Promise<number>;

  abstract findCandidatesByRunId(
    lifecycleRunId: string,
    campusId: string,
  ): Promise<SchoolYearLifecycleCandidate[]>;

  abstract findCandidateAggregates(
    lifecycleRunId: string,
    campusId: string,
  ): Promise<SchoolYearLifecycleCandidateAggregate[]>;

  abstract findCandidatePage(
    lifecycleRunId: string,
    campusId: string,
    query: SchoolYearLifecycleCandidateListQuery,
  ): Promise<SchoolYearLifecycleCandidatePage>;

  abstract findCandidatesByIds(
    lifecycleRunId: string,
    campusId: string,
    candidateIds: string[],
  ): Promise<SchoolYearLifecycleCandidate[]>;

  abstract findCandidatesByFilter(
    lifecycleRunId: string,
    campusId: string,
    filter: SchoolYearLifecycleCandidateFilter,
  ): Promise<SchoolYearLifecycleCandidate[]>;

  abstract findCandidatesBySourceClassIds(
    lifecycleRunId: string,
    campusId: string,
    sourceClassIds: string[],
  ): Promise<SchoolYearLifecycleCandidate[]>;

  abstract reconcileCandidatesVersioned(
    input: ReconcileSchoolYearLifecycleCandidatesVersionedInput,
  ): Promise<SchoolYearLifecycleRun | null>;

  abstract saveDecisionsVersioned(
    input: SaveSchoolYearLifecycleDecisionsVersionedInput,
  ): Promise<SchoolYearLifecycleRun | null>;

  abstract findOpenSourceCandidates(
    campusId: string,
    sourceSchoolYearId: string,
    studentIds?: string[],
    effectiveDate?: Date,
  ): Promise<SchoolYearLifecycleSourceCandidate[]>;

  abstract findOpenTargetRegistrationStudentIds(
    campusId: string,
    targetSchoolYearId: string,
    studentIds: string[],
  ): Promise<string[]>;

  abstract findCancelledTargetRegistrationStudentIds(
    campusId: string,
    targetSchoolYearId: string,
    studentIds: string[],
  ): Promise<string[]>;

  abstract findPreviewRunById(
    id: string,
    campusId: string,
  ): Promise<SchoolYearLifecyclePreviewRun | null>;

  abstract savePreviewRun(
    input: SaveSchoolYearLifecyclePreviewRunInput,
    tx?: AppTransactionClient,
  ): Promise<SchoolYearLifecyclePreviewRun>;

  abstract saveRunScopedPreview(
    input: SaveRunScopedSchoolYearLifecyclePreviewInput,
  ): Promise<SaveRunScopedSchoolYearLifecyclePreviewResult | null>;

  abstract findPreviewMemberships(
    previewRunId: string,
    campusId: string,
  ): Promise<SchoolYearLifecyclePreviewMembership[]>;

  abstract startCommitAttempt(input: {
    lifecycleRunId: string;
    previewRunId: string;
    runVersion: number;
    campusId: string;
    createdByUserId: string;
  }): Promise<string | null>;

  abstract finalizeCommitAttempt(
    input: FinalizeSchoolYearLifecycleCommitAttemptInput,
  ): Promise<{
    attempt: SchoolYearLifecycleCommitAttemptResult;
    run: SchoolYearLifecycleRun;
  }>;

  abstract persistSuccessfulCommitRow(
    input: {
      commitAttemptId: string;
      lifecycleRunId: string;
      previewRunId: string;
      campusId: string;
      candidateId: string;
      result: SchoolYearLifecycleCommitRowResult;
    },
    tx: AppTransactionClient,
  ): Promise<void>;

  abstract closeSourceEnrollmentsForCommit(
    parent: SchoolYearEnrollment,
    openChild: Enrollment | null,
    tx: AppTransactionClient,
  ): Promise<void>;

  abstract assertTargetRegistrationCanBeCreated(
    studentId: string,
    targetSchoolYearId: string,
    tx: AppTransactionClient,
  ): Promise<void>;

  abstract failCommitAttempt(
    commitAttemptId: string,
    previewRunId: string,
    campusId: string,
    retention?: SchoolYearLifecycleRetentionInput,
  ): Promise<void>;

  abstract findCommitAttempts(
    lifecycleRunId: string,
    campusId: string,
    limit: number,
  ): Promise<SchoolYearLifecycleCommitAttemptResult[]>;
}
