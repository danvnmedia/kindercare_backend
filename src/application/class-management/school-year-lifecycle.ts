import { createHash } from "crypto";
import type { EnrollmentPeriodConflictContext } from "./enrollment-period";

export const SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES = [
  "SETUP_INCOMPLETE",
  "DRAFT",
  "IN_PROGRESS",
  "PARTIALLY_COMMITTED",
  "NEEDS_RECONCILIATION",
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type SchoolYearLifecycleRunStatus =
  (typeof SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES)[number];

export const ACTIVE_SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES = [
  "SETUP_INCOMPLETE",
  "DRAFT",
  "IN_PROGRESS",
  "PARTIALLY_COMMITTED",
  "NEEDS_RECONCILIATION",
] as const satisfies readonly SchoolYearLifecycleRunStatus[];

export const SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES = [
  "NOT_STARTED",
  "NEEDS_REVIEW",
  "NEEDS_ACTION",
  "READY",
  "PREVIEWED",
  "COMMITTED",
  "ALREADY_APPLIED",
  "SKIPPED",
  "CONFLICT",
  "NO_LONGER_ELIGIBLE",
  "FAILED",
] as const;

export type SchoolYearLifecycleCandidateStatus =
  (typeof SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES)[number];

export const SCHOOL_YEAR_LIFECYCLE_PREVIEW_RUN_STATUSES = [
  "VALID",
  "COMMITTING",
  "INVALIDATED",
  "SUPERSEDED",
  "EXPIRED",
  "FINALIZED",
] as const;

export type SchoolYearLifecyclePreviewRunStatus =
  (typeof SCHOOL_YEAR_LIFECYCLE_PREVIEW_RUN_STATUSES)[number];

export const SCHOOL_YEAR_LIFECYCLE_COMMIT_ATTEMPT_STATUSES = [
  "RUNNING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
] as const;

export type SchoolYearLifecycleCommitAttemptStatus =
  (typeof SCHOOL_YEAR_LIFECYCLE_COMMIT_ATTEMPT_STATUSES)[number];

export const SCHOOL_YEAR_LIFECYCLE_SCOPE_TYPES = [
  "LEGACY",
  "GRADE",
  "CLASSES",
  "STUDENTS",
] as const;

export const SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES = 500;

export type SchoolYearLifecycleScopeType =
  (typeof SCHOOL_YEAR_LIFECYCLE_SCOPE_TYPES)[number];

export const SCHOOL_YEAR_LIFECYCLE_ERROR_CODES = [
  "ACTIVE_RUN_EXISTS",
  "RUN_NOT_FOUND",
  "RUN_VERSION_CONFLICT",
  "STALE_RUN_VERSION",
  "IDENTICAL_SCHOOL_YEARS",
  "NON_ADJACENT_SCHOOL_YEARS",
  "SCHOOL_YEAR_CAMPUS_MISMATCH",
  "INVALID_DATE",
  "SETUP_LOCKED",
  "RUN_NOT_CANCELLABLE",
  "RUN_CANCELLED",
  "RUN_EXPIRED",
  "RUN_NOT_EDITABLE",
  "CANDIDATE_NOT_FOUND",
  "CANDIDATE_NO_LONGER_ELIGIBLE",
  "CANDIDATE_COMMITTED",
  "INVALID_DECISION",
  "INVALID_TARGET_CLASS",
  "GRADUATION_NOT_ALLOWED",
  "SCOPE_TOO_LARGE",
  "INVALID_SCOPE",
  "UNRESOLVED_CANDIDATES",
  "EMPTY_EXPLICIT_SCOPE",
  "PREVIEW_NOT_FOUND",
  "PREVIEW_COMMIT_IN_PROGRESS",
  "PREVIEW_EXPIRED",
  "PREVIEW_INVALIDATED",
  "PREVIEW_SUPERSEDED",
  "PREVIEW_FINALIZED",
  "DIGEST_MISMATCH",
  "RUN_SCOPED_COMMIT_REQUIRED",
] as const;

export type SchoolYearLifecycleErrorCode =
  (typeof SCHOOL_YEAR_LIFECYCLE_ERROR_CODES)[number];

export class SchoolYearLifecycleInvariantError extends Error {
  constructor(
    public readonly code: SchoolYearLifecycleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SchoolYearLifecycleInvariantError";
  }
}

export interface SchoolYearLifecycleSchoolYearContext {
  id: string;
  campusId: string;
  startDate: Date;
  endDate: Date;
}

export interface SchoolYearLifecycleRun {
  id: string;
  campusId: string;
  sourceSchoolYearId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  status: SchoolYearLifecycleRunStatus;
  version: number;
  createdByUserId: string;
  updatedByUserId: string | null;
  firstCommittedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  expiredAt: Date | null;
  retentionExpiresAt: Date | null;
  retentionPolicySource: string | null;
  legalHold: boolean;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SchoolYearLifecycleCandidate {
  id: string;
  lifecycleRunId: string;
  campusId: string;
  studentId: string;
  sourceSchoolYearEnrollmentId: string;
  sourceEnrollmentId: string | null;
  sourceGradeLevelId: string;
  sourceClassId: string | null;
  status: SchoolYearLifecycleCandidateStatus;
  recommendedOutcome: SchoolYearLifecycleOutcome;
  decision: SchoolYearLifecycleOutcome | null;
  targetGradeLevelId: string | null;
  targetClassId: string | null;
  decisionNote: string | null;
  conflictCode: SchoolYearLifecycleErrorCode | null;
  message: string | null;
  decisionUpdatedByUserId: string | null;
  decisionUpdatedAt: Date | null;
  rowVersion: number;
  committedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const SCHOOL_YEAR_LIFECYCLE_CANDIDATE_SORT_FIELDS = [
  "studentName",
  "studentCode",
  "gradeOrder",
  "className",
  "status",
  "updatedAt",
] as const;

export type SchoolYearLifecycleCandidateSortField =
  (typeof SCHOOL_YEAR_LIFECYCLE_CANDIDATE_SORT_FIELDS)[number];

export interface SchoolYearLifecycleCandidateListQuery {
  offset: number;
  limit: number;
  search?: string;
  sourceGradeLevelId?: string;
  sourceClassId?: string | null;
  status?: SchoolYearLifecycleCandidateStatus;
  sortBy: SchoolYearLifecycleCandidateSortField;
  sortOrder: "asc" | "desc";
}

export type SchoolYearLifecycleCandidateFilter = Pick<
  SchoolYearLifecycleCandidateListQuery,
  "search" | "sourceGradeLevelId" | "sourceClassId" | "status"
>;

export interface SchoolYearLifecycleDecisionInput {
  candidateId: string;
  outcome: SchoolYearLifecycleOutcome;
  targetClassId?: string;
  note?: string;
}

export interface SchoolYearLifecycleDecisionRejection {
  candidateId: string;
  code: SchoolYearLifecycleErrorCode;
  message: string;
}

export interface SchoolYearLifecycleDecisionSaveResult {
  lifecycleRunId: string;
  scopeIdentity: string;
  affectedCount: number;
  rejectedCount: number;
  rejected: SchoolYearLifecycleDecisionRejection[];
  version: number;
}

export interface SchoolYearLifecycleCandidateListItem {
  id: string;
  lifecycleRunId: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  sourceSchoolYearEnrollmentId: string;
  sourceEnrollmentId: string | null;
  sourceGradeLevelId: string;
  sourceGradeLevelName: string | null;
  sourceGradeLevelOrder: number | null;
  sourceClassId: string | null;
  sourceClassName: string | null;
  status: SchoolYearLifecycleCandidateStatus;
  recommendedOutcome: SchoolYearLifecycleOutcome;
  decision: SchoolYearLifecycleOutcome | null;
  targetGradeLevelId: string | null;
  targetClassId: string | null;
  targetClassName: string | null;
  decisionNote: string | null;
  conflictCode: SchoolYearLifecycleErrorCode | null;
  message: string | null;
  rowVersion: number;
  decisionUpdatedByUserId: string | null;
  decisionUpdatedAt: Date | null;
  committedAt: Date | null;
  updatedAt: Date;
}

export interface SchoolYearLifecycleCandidatePage {
  data: SchoolYearLifecycleCandidateListItem[];
  pagination: {
    count: number;
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SchoolYearLifecycleProgressCounts {
  eligible: number;
  notStarted: number;
  needsAction: number;
  ready: number;
  previewed: number;
  skipped: number;
  committed: number;
  alreadyApplied: number;
  conflict: number;
  failed: number;
  needsReview: number;
  noLongerEligible: number;
  complete: number;
  remaining: number;
  completionPercent: number;
}

export interface SchoolYearLifecycleClassProgress
  extends SchoolYearLifecycleProgressCounts {
  classId: string | null;
  className: string | null;
}

export interface SchoolYearLifecycleGradeProgress
  extends SchoolYearLifecycleProgressCounts {
  gradeLevelId: string;
  gradeLevelName: string | null;
  gradeLevelOrder: number | null;
  classes: SchoolYearLifecycleClassProgress[];
}

export interface SchoolYearLifecycleRunDetail {
  run: SchoolYearLifecycleRun;
  sourceSchoolYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  };
  targetSchoolYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  };
  totals: SchoolYearLifecycleProgressCounts;
  grades: SchoolYearLifecycleGradeProgress[];
}

export interface SchoolYearLifecycleCandidateAggregate {
  sourceGradeLevelId: string;
  sourceGradeLevelName: string | null;
  sourceGradeLevelOrder: number | null;
  sourceClassId: string | null;
  sourceClassName: string | null;
  status: SchoolYearLifecycleCandidateStatus;
  decision: SchoolYearLifecycleOutcome | null;
  targetClassId: string | null;
  count: number;
}

export function buildSchoolYearLifecycleProgress(
  aggregates: SchoolYearLifecycleCandidateAggregate[],
): {
  totals: SchoolYearLifecycleProgressCounts;
  grades: SchoolYearLifecycleGradeProgress[];
} {
  const totals = emptyProgressCounts();
  const gradeMap = new Map<
    string,
    SchoolYearLifecycleGradeProgress & {
      classMap: Map<string, SchoolYearLifecycleClassProgress>;
    }
  >();

  for (const aggregate of aggregates) {
    applyProgressAggregate(totals, aggregate);
    let grade = gradeMap.get(aggregate.sourceGradeLevelId);
    if (!grade) {
      grade = {
        gradeLevelId: aggregate.sourceGradeLevelId,
        gradeLevelName: aggregate.sourceGradeLevelName,
        gradeLevelOrder: aggregate.sourceGradeLevelOrder,
        classes: [],
        classMap: new Map(),
        ...emptyProgressCounts(),
      };
      gradeMap.set(aggregate.sourceGradeLevelId, grade);
    }
    applyProgressAggregate(grade, aggregate);

    const classKey = aggregate.sourceClassId ?? "__UNASSIGNED__";
    let classProgress = grade.classMap.get(classKey);
    if (!classProgress) {
      classProgress = {
        classId: aggregate.sourceClassId,
        className: aggregate.sourceClassName,
        ...emptyProgressCounts(),
      };
      grade.classMap.set(classKey, classProgress);
    }
    applyProgressAggregate(classProgress, aggregate);
  }

  finalizeProgressCounts(totals);
  const grades = [...gradeMap.values()]
    .sort(
      (left, right) =>
        (left.gradeLevelOrder ?? Number.MAX_SAFE_INTEGER) -
          (right.gradeLevelOrder ?? Number.MAX_SAFE_INTEGER) ||
        left.gradeLevelId.localeCompare(right.gradeLevelId),
    )
    .map((grade) => {
      finalizeProgressCounts(grade);
      grade.classes = [...grade.classMap.values()]
        .map((classProgress) => {
          finalizeProgressCounts(classProgress);
          return classProgress;
        })
        .sort(
          (left, right) =>
            (left.className ?? "").localeCompare(right.className ?? "") ||
            (left.classId ?? "").localeCompare(right.classId ?? ""),
        );
      const { classMap, ...progress } = grade;
      void classMap;
      return progress;
    });

  return { totals, grades };
}

export function deriveSchoolYearLifecycleRunStatusAfterCommit(input: {
  eligibleCount: number;
  completeCount: number;
  hasPriorSuccessfulCommit: boolean;
  successCount: number;
  alreadyAppliedCount: number;
  failedCount: number;
}): SchoolYearLifecycleRunStatus {
  if (input.eligibleCount === input.completeCount) {
    return "COMPLETED";
  }
  if (
    input.hasPriorSuccessfulCommit ||
    input.successCount + input.alreadyAppliedCount > 0
  ) {
    return "PARTIALLY_COMMITTED";
  }
  return input.failedCount > 0 ? "NEEDS_RECONCILIATION" : "IN_PROGRESS";
}

export const SCHOOL_YEAR_LIFECYCLE_OUTCOMES = [
  "PROMOTE",
  "RETAIN",
  "GRADUATE",
  "SKIP",
] as const;

export type SchoolYearLifecycleOutcome =
  (typeof SCHOOL_YEAR_LIFECYCLE_OUTCOMES)[number];

export const SCHOOL_YEAR_LIFECYCLE_PREVIEW_STATUSES = [
  "READY",
  "SKIPPED",
  "CONFLICT",
] as const;

export type SchoolYearLifecyclePreviewStatus =
  (typeof SCHOOL_YEAR_LIFECYCLE_PREVIEW_STATUSES)[number];

export const SCHOOL_YEAR_LIFECYCLE_COMMIT_STATUSES = [
  "SUCCESS",
  "SKIPPED",
  "ALREADY_APPLIED",
  "FAILED",
] as const;

export type SchoolYearLifecycleCommitStatus =
  (typeof SCHOOL_YEAR_LIFECYCLE_COMMIT_STATUSES)[number];

export const SCHOOL_YEAR_LIFECYCLE_CONFLICT_CODES = [
  "EXISTING_TARGET_REGISTRATION",
  "CANCELLED_TARGET_REGISTRATION",
  "MISSING_TARGET_CLASS",
  "GRADE_LEVEL_MISMATCH",
  "INVALID_DATE",
  "MISSING_SOURCE_REGISTRATION",
  "ENROLLMENT_PERIOD_OVERLAP",
] as const;

export type SchoolYearLifecycleConflictCode =
  (typeof SCHOOL_YEAR_LIFECYCLE_CONFLICT_CODES)[number];

export const SCHOOL_YEAR_LIFECYCLE_OPERATION_TYPES = [
  "CLOSE_SOURCE_SCHOOL_YEAR_ENROLLMENT",
  "CLOSE_SOURCE_CLASS_ENROLLMENT",
  "CREATE_TARGET_SCHOOL_YEAR_ENROLLMENT",
  "CREATE_TARGET_CLASS_ENROLLMENT",
  "GRADUATE",
  "RETAIN",
  "SKIP",
] as const;

export type SchoolYearLifecycleOperationType =
  (typeof SCHOOL_YEAR_LIFECYCLE_OPERATION_TYPES)[number];

export interface SchoolYearLifecycleRowInput {
  studentId: string;
  outcome?: SchoolYearLifecycleOutcome;
  targetClassId?: string;
  note?: string;
}

export interface SchoolYearLifecyclePreviewInput {
  campusId: string;
  sourceSchoolYearId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  rows: SchoolYearLifecycleRowInput[];
}

export interface SchoolYearLifecycleCommitInput {
  campusId: string;
  previewRunId: string;
  digest: string;
  allowRunScoped?: boolean;
  lifecycleRunId?: string;
  runVersion?: number;
  scopeIdentity?: string | null;
  commitAttemptId?: string;
  candidateIdsByStudentId?: Record<string, string>;
}

export interface SchoolYearLifecycleOperation {
  type: SchoolYearLifecycleOperationType;
  sourceId?: string;
  targetId?: string;
  reason?: string;
}

export interface SchoolYearLifecycleRowContext {
  studentName?: string | null;
  sourceSchoolYearEnrollmentId?: string;
  sourceClassEnrollmentId?: string;
  sourceGradeLevelId?: string;
  sourceGradeLevelName?: string | null;
  sourceGradeLevelOrder?: number | null;
  targetSchoolYearEnrollmentId?: string;
  targetClassEnrollmentId?: string;
  targetClassId?: string;
  targetClassName?: string | null;
  targetGradeLevelId?: string;
  targetGradeLevelName?: string | null;
  targetGradeLevelOrder?: number | null;
  conflictingEnrollment?: EnrollmentPeriodConflictContext | null;
}

export interface SchoolYearLifecyclePreviewRow {
  studentId: string;
  outcome: SchoolYearLifecycleOutcome;
  targetClassId?: string;
  status: SchoolYearLifecyclePreviewStatus;
  conflictCode?: SchoolYearLifecycleConflictCode;
  conflictCodes: SchoolYearLifecycleConflictCode[];
  operations: SchoolYearLifecycleOperation[];
  context: SchoolYearLifecycleRowContext;
}

export interface SchoolYearLifecyclePreviewResult {
  previewRunId: string;
  digest: string;
  campusId: string;
  sourceSchoolYearId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  rows: SchoolYearLifecyclePreviewRow[];
}

export interface SchoolYearLifecyclePreviewScope {
  type: Exclude<SchoolYearLifecycleScopeType, "LEGACY">;
  gradeLevelId?: string;
  classIds?: string[];
  candidateIds?: string[];
  batchIndex?: number;
}

export interface SchoolYearLifecyclePreviewBatch {
  batchId: string;
  classId: string;
  batchIndex: number;
  totalBatches: number;
  candidateCount: number;
}

export interface RunScopedSchoolYearLifecyclePreviewResult
  extends SchoolYearLifecyclePreviewResult {
  lifecycleRunId: string;
  runVersion: number;
  scopeType: Exclude<SchoolYearLifecycleScopeType, "LEGACY">;
  scopeIdentity: string;
  expiresAt: Date;
  summary: {
    rowCount: number;
    readyCount: number;
    conflictCount: number;
    skippedCount: number;
  };
}

export interface SchoolYearLifecycleCommitRowResult {
  studentId: string;
  outcome: SchoolYearLifecycleOutcome;
  targetClassId?: string;
  status: SchoolYearLifecycleCommitStatus;
  conflictCode?: SchoolYearLifecycleConflictCode;
  message?: string;
  operations: SchoolYearLifecycleOperation[];
  context: SchoolYearLifecycleRowContext;
}

export interface SchoolYearLifecycleCommitResult {
  previewRunId: string;
  digest: string;
  campusId: string;
  sourceSchoolYearId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  rows: SchoolYearLifecycleCommitRowResult[];
}

export interface RunScopedSchoolYearLifecycleCommitResult
  extends SchoolYearLifecycleCommitResult {
  lifecycleRunId: string;
  commitAttemptId: string;
  runStatus: SchoolYearLifecycleRunStatus;
  runVersion: number;
}

export interface SchoolYearLifecyclePersistedCommitRowResult {
  id: string;
  candidateId: string;
  studentId: string;
  status: SchoolYearLifecycleCommitStatus;
  outcome: SchoolYearLifecycleOutcome;
  targetClassId: string | null;
  conflictCode: string | null;
  message: string | null;
  resultingSchoolYearEnrollmentId: string | null;
  resultingClassEnrollmentId: string | null;
  operations: SchoolYearLifecycleOperation[];
  context: SchoolYearLifecycleRowContext;
  createdAt: Date;
}

export interface SchoolYearLifecycleCommitAttemptResult {
  id: string;
  lifecycleRunId: string;
  previewRunId: string;
  campusId: string;
  status: SchoolYearLifecycleCommitAttemptStatus;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  alreadyAppliedCount: number;
  createdByUserId: string;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  rows: SchoolYearLifecyclePersistedCommitRowResult[];
}

export function buildSchoolYearLifecycleDigest(
  input: SchoolYearLifecyclePreviewInput,
): string {
  return createHash("sha256")
    .update(JSON.stringify(toCanonicalLifecycleInput(input)))
    .digest("hex");
}

export function toCanonicalLifecycleInput(
  input: SchoolYearLifecyclePreviewInput,
) {
  return sortObjectKeys({
    campusId: input.campusId,
    sourceSchoolYearId: input.sourceSchoolYearId,
    targetSchoolYearId: input.targetSchoolYearId,
    sourceClosureDate: toDateOnlyString(input.sourceClosureDate),
    targetEnrollmentDate: toDateOnlyString(input.targetEnrollmentDate),
    rows: input.rows
      .map((row) =>
        sortObjectKeys({
          studentId: row.studentId,
          outcome: row.outcome ?? null,
          targetClassId: row.targetClassId ?? null,
          note: row.note ?? null,
        }),
      )
      .sort((a, b) => {
        const left = String(a.studentId);
        const right = String(b.studentId);
        return left.localeCompare(right);
      }),
  });
}

export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toSerializableLifecyclePreviewResult(
  result: SchoolYearLifecyclePreviewResult,
): Record<string, unknown> {
  return {
    ...result,
    sourceClosureDate: toDateOnlyString(result.sourceClosureDate),
    targetEnrollmentDate: toDateOnlyString(result.targetEnrollmentDate),
  };
}

export function toSerializableLifecycleCommitResult(
  result: SchoolYearLifecycleCommitResult,
): Record<string, unknown> {
  return {
    ...result,
    sourceClosureDate: toDateOnlyString(result.sourceClosureDate),
    targetEnrollmentDate: toDateOnlyString(result.targetEnrollmentDate),
  };
}

export function lifecyclePreviewInputFromPersistedPayload(
  payload: unknown,
): SchoolYearLifecyclePreviewInput {
  const envelope = payload as { normalizedInput?: unknown };
  if (envelope?.normalizedInput) {
    return lifecyclePreviewInputFromPersistedPayload(envelope.normalizedInput);
  }
  const value = payload as {
    campusId?: string;
    sourceSchoolYearId?: string;
    targetSchoolYearId?: string;
    sourceClosureDate?: string;
    targetEnrollmentDate?: string;
    rows?: Array<{
      studentId?: string;
      outcome?: SchoolYearLifecycleOutcome | null;
      targetClassId?: string | null;
      note?: string | null;
    }>;
  };

  if (
    !value ||
    typeof value.campusId !== "string" ||
    typeof value.sourceSchoolYearId !== "string" ||
    typeof value.targetSchoolYearId !== "string" ||
    typeof value.sourceClosureDate !== "string" ||
    typeof value.targetEnrollmentDate !== "string" ||
    !Array.isArray(value.rows)
  ) {
    throw new Error("INVALID_PREVIEW_PAYLOAD");
  }

  return {
    campusId: value.campusId,
    sourceSchoolYearId: value.sourceSchoolYearId,
    targetSchoolYearId: value.targetSchoolYearId,
    sourceClosureDate: parsePersistedDateOnly(value.sourceClosureDate),
    targetEnrollmentDate: parsePersistedDateOnly(value.targetEnrollmentDate),
    rows: value.rows.map((row) => ({
      studentId: String(row.studentId),
      outcome: row.outcome ?? undefined,
      targetClassId: row.targetClassId ?? undefined,
      note: row.note ?? undefined,
    })),
  };
}

export function assertSchoolYearLifecycleSetup(input: {
  campusId: string;
  sourceSchoolYear: SchoolYearLifecycleSchoolYearContext;
  targetSchoolYear: SchoolYearLifecycleSchoolYearContext;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  nextSchoolYearId: string | null;
}): void {
  const {
    campusId,
    sourceSchoolYear,
    targetSchoolYear,
    sourceClosureDate,
    targetEnrollmentDate,
    nextSchoolYearId,
  } = input;

  if (sourceSchoolYear.id === targetSchoolYear.id) {
    throw new SchoolYearLifecycleInvariantError(
      "IDENTICAL_SCHOOL_YEARS",
      "Source and target school years must be different.",
    );
  }

  if (
    sourceSchoolYear.campusId !== campusId ||
    targetSchoolYear.campusId !== campusId
  ) {
    throw new SchoolYearLifecycleInvariantError(
      "SCHOOL_YEAR_CAMPUS_MISMATCH",
      "Source and target school years must belong to the selected campus.",
    );
  }

  if (
    nextSchoolYearId !== targetSchoolYear.id ||
    toUtcDateOnly(targetSchoolYear.startDate).getTime() <=
      toUtcDateOnly(sourceSchoolYear.endDate).getTime()
  ) {
    throw new SchoolYearLifecycleInvariantError(
      "NON_ADJACENT_SCHOOL_YEARS",
      "Target school year must be the immediately following school year.",
    );
  }

  assertLifecycleDateWithinSchoolYear(sourceClosureDate, sourceSchoolYear);
  assertLifecycleDateWithinSchoolYear(targetEnrollmentDate, targetSchoolYear);
}

export function assertLifecycleDateWithinSchoolYear(
  date: Date,
  schoolYear: { startDate: Date; endDate: Date },
): void {
  if (!isLifecycleDateWithinSchoolYear(date, schoolYear)) {
    throw new SchoolYearLifecycleInvariantError(
      "INVALID_DATE",
      "Lifecycle date must be a valid date within its school year.",
    );
  }
}

export function isLifecycleDateWithinSchoolYear(
  date: Date,
  schoolYear: { startDate: Date; endDate: Date },
): boolean {
  if (
    !isValidDate(date) ||
    !isValidDate(schoolYear.startDate) ||
    !isValidDate(schoolYear.endDate)
  ) {
    return false;
  }

  const day = toUtcDateOnly(date).getTime();
  const start = toUtcDateOnly(schoolYear.startDate).getTime();
  const end = toUtcDateOnly(schoolYear.endDate).getTime();
  return day >= start && day <= end;
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function toUtcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function emptyProgressCounts(): SchoolYearLifecycleProgressCounts {
  return {
    eligible: 0,
    notStarted: 0,
    needsAction: 0,
    ready: 0,
    previewed: 0,
    skipped: 0,
    committed: 0,
    alreadyApplied: 0,
    conflict: 0,
    failed: 0,
    needsReview: 0,
    noLongerEligible: 0,
    complete: 0,
    remaining: 0,
    completionPercent: 0,
  };
}

function applyProgressAggregate(
  progress: SchoolYearLifecycleProgressCounts,
  aggregate: SchoolYearLifecycleCandidateAggregate,
): void {
  const { count, status } = aggregate;
  if (status === "NO_LONGER_ELIGIBLE") {
    progress.noLongerEligible += count;
    return;
  }

  progress.eligible += count;
  switch (status) {
    case "NOT_STARTED":
      progress.notStarted += count;
      if (!aggregate.decision) {
        progress.needsAction += count;
      }
      break;
    case "NEEDS_ACTION":
      progress.needsAction += count;
      break;
    case "NEEDS_REVIEW":
      progress.needsReview += count;
      break;
    case "READY":
      progress.ready += count;
      break;
    case "PREVIEWED":
      progress.previewed += count;
      break;
    case "SKIPPED":
      progress.skipped += count;
      progress.complete += count;
      break;
    case "COMMITTED":
      progress.committed += count;
      progress.complete += count;
      break;
    case "ALREADY_APPLIED":
      progress.alreadyApplied += count;
      progress.complete += count;
      break;
    case "CONFLICT":
      progress.conflict += count;
      break;
    case "FAILED":
      progress.failed += count;
      break;
  }
}

function finalizeProgressCounts(
  progress: SchoolYearLifecycleProgressCounts,
): void {
  progress.remaining = Math.max(progress.eligible - progress.complete, 0);
  progress.completionPercent =
    progress.eligible === 0
      ? 100
      : Math.round((progress.complete / progress.eligible) * 10_000) / 100;
}

function sortObjectKeys<T extends Record<string, unknown>>(value: T): T {
  return Object.keys(value)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = value[key];
        return acc;
      },
      {} as Record<string, unknown>,
    ) as T;
}

function parsePersistedDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
