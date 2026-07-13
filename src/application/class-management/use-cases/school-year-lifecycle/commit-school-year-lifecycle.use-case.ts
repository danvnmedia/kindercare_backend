import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { User } from "@/domain/user-management/user.entity";

import {
  buildEnrollmentSnapshot,
  buildSchoolYearEnrollmentSnapshot,
} from "../../historical-snapshot";
import { ClassRepository } from "../../ports/class.repository";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { EnrollmentErrorCode } from "../../enrollment-error-codes";
import {
  buildEnrollmentPeriodOverlapDetails,
  EnrollmentPeriodOverlapError,
  isEnrollmentPeriodOverlapPersistenceError,
} from "../../enrollment-period";
import {
  buildSchoolYearLifecycleDigest,
  isLifecycleDateWithinSchoolYear,
  lifecyclePreviewInputFromPersistedPayload,
  SchoolYearLifecycleCommitInput,
  SchoolYearLifecycleCommitResult,
  SchoolYearLifecycleCommitRowResult,
  toUtcDateOnly,
} from "../../school-year-lifecycle";
import {
  buildSchoolYearLifecyclePlan,
  SchoolYearLifecyclePlannedRow,
} from "./school-year-lifecycle-planner";

@Injectable()
export class CommitSchoolYearLifecycleUseCase {
  private readonly logger = new Logger(CommitSchoolYearLifecycleUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(
    input: SchoolYearLifecycleCommitInput,
    currentUser: User,
  ): Promise<SchoolYearLifecycleCommitResult> {
    const previewRun = await this.lifecycleRepository.findPreviewRunById(
      input.previewRunId,
      input.campusId,
    );
    if (!previewRun) {
      throw new NotFoundException("PREVIEW_RUN_NOT_FOUND");
    }
    if (previewRun.lifecycleRunId && !input.allowRunScoped) {
      throw new BadRequestException("RUN_SCOPED_COMMIT_REQUIRED");
    }
    const expectedStatus = previewRun.lifecycleRunId ? "COMMITTING" : "VALID";
    if (previewRun.status && previewRun.status !== expectedStatus) {
      const code =
        previewRun.status === "EXPIRED"
          ? "PREVIEW_EXPIRED"
          : previewRun.status === "SUPERSEDED"
            ? "PREVIEW_SUPERSEDED"
            : previewRun.status === "FINALIZED"
              ? "PREVIEW_FINALIZED"
              : previewRun.status === "COMMITTING"
                ? "PREVIEW_COMMIT_IN_PROGRESS"
                : "PREVIEW_INVALIDATED";
      throw new BadRequestException(code);
    }
    if (previewRun.expiresAt && previewRun.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException("PREVIEW_EXPIRED");
    }
    if (previewRun.digest !== input.digest) {
      throw new BadRequestException("PREVIEW_DIGEST_MISMATCH");
    }

    const previewInput = lifecyclePreviewInputFromPersistedPayload(
      previewRun.requestPayload,
    );
    if (
      !previewRun.lifecycleRunId &&
      buildSchoolYearLifecycleDigest(previewInput) !== input.digest
    ) {
      throw new BadRequestException("PREVIEW_DIGEST_MISMATCH");
    }

    const sourceSchoolYear = await this.schoolYearRepository.findById(
      previewInput.sourceSchoolYearId,
    );
    if (!sourceSchoolYear || sourceSchoolYear.campusId !== input.campusId) {
      throw new NotFoundException("SOURCE_SCHOOL_YEAR_NOT_FOUND");
    }

    const targetSchoolYear = await this.schoolYearRepository.findById(
      previewInput.targetSchoolYearId,
    );
    if (!targetSchoolYear || targetSchoolYear.campusId !== input.campusId) {
      throw new NotFoundException("TARGET_SCHOOL_YEAR_NOT_FOUND");
    }

    if (
      !isLifecycleDateWithinSchoolYear(
        previewInput.sourceClosureDate,
        sourceSchoolYear,
      ) ||
      !isLifecycleDateWithinSchoolYear(
        previewInput.targetEnrollmentDate,
        targetSchoolYear,
      )
    ) {
      throw new BadRequestException("INVALID_DATE");
    }

    const plan = await buildSchoolYearLifecyclePlan(
      previewInput,
      sourceSchoolYear,
      targetSchoolYear,
      {
        lifecycleRepository: this.lifecycleRepository,
        schoolYearEnrollmentRepository: this.schoolYearEnrollmentRepository,
        classRepository: this.classRepository,
      },
    );

    const rows: SchoolYearLifecycleCommitRowResult[] = [];
    for (const planned of plan.rows) {
      if (planned.row.outcome === "SKIP") {
        rows.push({
          studentId: planned.row.studentId,
          outcome: planned.row.outcome,
          targetClassId: planned.row.targetClassId,
          status: "SKIPPED",
          operations: planned.row.operations,
          context: planned.row.context,
        });
        continue;
      }

      const alreadyApplied = await this.detectAlreadyApplied(
        previewInput,
        planned,
      );
      if (alreadyApplied) {
        rows.push(alreadyApplied);
        continue;
      }

      if (planned.row.status === "CONFLICT" || !planned.candidate) {
        rows.push({
          studentId: planned.row.studentId,
          outcome: planned.row.outcome,
          targetClassId: planned.row.targetClassId,
          status: "FAILED",
          conflictCode:
            planned.row.conflictCode ?? "MISSING_SOURCE_REGISTRATION",
          operations: [],
          context: planned.row.context,
        });
        continue;
      }

      try {
        rows.push(
          await this.applyRow(
            previewInput,
            planned,
            previewRun.id,
            previewRun.digest,
            sourceSchoolYear.name,
            targetSchoolYear.name,
            currentUser,
            input,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const periodOverlap =
          error instanceof EnrollmentPeriodOverlapError ||
          isEnrollmentPeriodOverlapPersistenceError(error);
        const targetRegistrationConflict =
          error instanceof ExistingTargetRegistrationError ||
          message === "EXISTING_TARGET_REGISTRATION";
        const cancelledTargetConflict =
          message === "CANCELLED_TARGET_REGISTRATION";
        const cancelledSourceConflict =
          message === "LIFECYCLE_SOURCE_REGISTRATION_CANCELLED";
        this.logger.warn(
          `School-year lifecycle row failed: previewRunId=${previewRun.id} studentId=${planned.row.studentId} ${message}`,
        );
        rows.push({
          studentId: planned.row.studentId,
          outcome: planned.row.outcome,
          targetClassId: planned.row.targetClassId,
          status: cancelledSourceConflict ? "SKIPPED" : "FAILED",
          conflictCode: periodOverlap
            ? EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP
            : cancelledTargetConflict
              ? "CANCELLED_TARGET_REGISTRATION"
              : targetRegistrationConflict
                ? "EXISTING_TARGET_REGISTRATION"
                : undefined,
          message: periodOverlap
            ? EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP
            : cancelledTargetConflict
              ? "CANCELLED_TARGET_REGISTRATION"
              : targetRegistrationConflict
                ? "EXISTING_TARGET_REGISTRATION"
                : cancelledSourceConflict
                  ? "SOURCE_REGISTRATION_CANCELLED"
                  : message,
          operations: [],
          context: periodOverlap
            ? {
                ...planned.row.context,
                conflictingEnrollment:
                  error instanceof EnrollmentPeriodOverlapError
                    ? buildEnrollmentPeriodOverlapDetails(
                        error.conflictingEnrollment,
                      ).conflictingEnrollment
                    : null,
              }
            : planned.row.context,
        });
      }
    }

    const result: SchoolYearLifecycleCommitResult = {
      previewRunId: previewRun.id,
      digest: previewRun.digest,
      campusId: input.campusId,
      sourceSchoolYearId: previewInput.sourceSchoolYearId,
      targetSchoolYearId: previewInput.targetSchoolYearId,
      sourceClosureDate: previewInput.sourceClosureDate,
      targetEnrollmentDate: previewInput.targetEnrollmentDate,
      rows,
    };

    await this.recordBatchCommitAudit(
      result,
      sourceSchoolYear.name,
      targetSchoolYear.name,
      currentUser,
      input,
    );

    this.logger.log(
      `School-year lifecycle commit ${previewRun.id}: campus=${input.campusId} rows=${rows.length}`,
    );
    return result;
  }

  private async applyRow(
    input: ReturnType<typeof lifecyclePreviewInputFromPersistedPayload>,
    planned: SchoolYearLifecyclePlannedRow,
    previewRunId: string,
    digest: string,
    sourceSchoolYearName: string,
    targetSchoolYearName: string,
    currentUser: User,
    commitInput: SchoolYearLifecycleCommitInput,
  ): Promise<SchoolYearLifecycleCommitRowResult> {
    const candidate = planned.candidate;
    if (!candidate) {
      throw new Error("MISSING_SOURCE_REGISTRATION");
    }

    const targetClass = planned.targetClass;
    const reason =
      planned.row.outcome === "GRADUATE"
        ? ExitReason.GRADUATED
        : ExitReason.COMPLETED;
    const rowNote = planned.input.note;

    if (
      (planned.row.outcome === "PROMOTE" || planned.row.outcome === "RETAIN") &&
      targetClass
    ) {
      const overlap =
        await this.enrollmentRepository.findOverlappingByStudentId(
          candidate.schoolYearEnrollment.studentId,
          input.targetEnrollmentDate,
          null,
          candidate.activeEnrollment?.id,
        );
      if (overlap) {
        throw new EnrollmentPeriodOverlapError(overlap);
      }
    }

    return await this.transactionRunner.run(async (tx) => {
      const closedParent = closeSchoolYearEnrollmentForLifecycle(
        candidate.schoolYearEnrollment,
        input.sourceClosureDate,
        reason,
        rowNote,
      );
      const closedChild = candidate.activeEnrollment
        ? closeEnrollmentForLifecycle(
            candidate.activeEnrollment,
            input.sourceClosureDate,
            reason,
            rowNote,
          )
        : null;

      await this.lifecycleRepository.closeSourceEnrollmentsForCommit(
        closedParent,
        closedChild,
        tx,
      );

      let targetParent: SchoolYearEnrollment | null = null;
      let targetEnrollment: Enrollment | null = null;

      if (
        planned.row.outcome === "PROMOTE" ||
        planned.row.outcome === "RETAIN"
      ) {
        if (
          !targetClass ||
          !targetClass.gradeLevel ||
          !targetClass.schoolYear
        ) {
          throw new Error("MISSING_TARGET_CLASS");
        }
        const student = candidate.schoolYearEnrollment.student;
        if (!student) {
          throw new Error("STUDENT_SNAPSHOT_SOURCE_MISSING");
        }
        await this.lifecycleRepository.assertTargetRegistrationCanBeCreated(
          candidate.schoolYearEnrollment.studentId,
          input.targetSchoolYearId,
          tx,
        );

        const parent = SchoolYearEnrollment.create({
          studentId: candidate.schoolYearEnrollment.studentId,
          campusId: input.campusId,
          schoolYearId: input.targetSchoolYearId,
          gradeLevelId: targetClass.gradeLevelId,
          enrollmentDate: input.targetEnrollmentDate,
          note: rowNote ?? null,
          ...buildSchoolYearEnrollmentSnapshot(
            student,
            targetClass.gradeLevel,
            targetClass.schoolYear,
          ),
        });
        try {
          targetParent = await this.schoolYearEnrollmentRepository.save(
            parent,
            tx,
          );
        } catch (error) {
          if (isUniqueConstraintPersistenceError(error)) {
            throw new ExistingTargetRegistrationError();
          }
          throw error;
        }

        const enrollment = Enrollment.create({
          classId: targetClass.id,
          studentId: candidate.schoolYearEnrollment.studentId,
          schoolYearEnrollmentId: targetParent.id,
          enrollmentDate: input.targetEnrollmentDate,
          note: rowNote ?? null,
          ...buildEnrollmentSnapshot(student, targetClass),
        });
        try {
          targetEnrollment = await this.enrollmentRepository.save(
            enrollment,
            tx,
          );
        } catch (error) {
          if (isEnrollmentPeriodOverlapPersistenceError(error)) {
            throw new EnrollmentPeriodOverlapError(null);
          }
          throw error;
        }
      }

      const context = {
        ...planned.row.context,
        targetSchoolYearEnrollmentId: targetParent?.id,
        targetClassEnrollmentId: targetEnrollment?.id,
      };
      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "COMMIT_SCHOOL_YEAR_LIFECYCLE_ROW",
          targetType: "student",
          targetId: planned.row.studentId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            lifecycleRunId: commitInput.lifecycleRunId ?? null,
            runVersion: commitInput.runVersion ?? null,
            scopeIdentity: commitInput.scopeIdentity ?? null,
            previewRunId,
            digest,
            sourceSchoolYearId: input.sourceSchoolYearId,
            sourceSchoolYearName,
            targetSchoolYearId: input.targetSchoolYearId,
            targetSchoolYearName,
            sourceClosureDate: input.sourceClosureDate.toISOString(),
            targetEnrollmentDate: input.targetEnrollmentDate.toISOString(),
            outcome: planned.row.outcome,
            status: "SUCCESS",
            operations: planned.row.operations,
            rowContext: context,
          },
        },
        tx,
      );

      const result: SchoolYearLifecycleCommitRowResult = {
        studentId: planned.row.studentId,
        outcome: planned.row.outcome,
        targetClassId: planned.row.targetClassId,
        status: "SUCCESS",
        operations: planned.row.operations,
        context,
      };
      const candidateId =
        commitInput.candidateIdsByStudentId?.[planned.row.studentId];
      if (commitInput.commitAttemptId && commitInput.lifecycleRunId) {
        if (!candidateId) {
          throw new Error("COMMIT_SCOPE_MEMBERSHIP_MISMATCH");
        }
        await this.lifecycleRepository.persistSuccessfulCommitRow(
          {
            commitAttemptId: commitInput.commitAttemptId,
            lifecycleRunId: commitInput.lifecycleRunId,
            previewRunId,
            campusId: input.campusId,
            candidateId,
            result,
          },
          tx,
        );
      }
      return result;
    });
  }

  private async detectAlreadyApplied(
    input: ReturnType<typeof lifecyclePreviewInputFromPersistedPayload>,
    planned: SchoolYearLifecyclePlannedRow,
  ): Promise<SchoolYearLifecycleCommitRowResult | null> {
    const expectedReason =
      planned.row.outcome === "GRADUATE"
        ? ExitReason.GRADUATED
        : ExitReason.COMPLETED;
    const latestSource =
      await this.schoolYearEnrollmentRepository.findLatestByStudentAndSchoolYear(
        planned.row.studentId,
        input.sourceSchoolYearId,
      );

    if (
      !latestSource ||
      !latestSource.exitDate ||
      latestSource.exitReason !== expectedReason ||
      !sameDateOnly(latestSource.exitDate, input.sourceClosureDate)
    ) {
      return null;
    }

    if (planned.row.outcome === "GRADUATE") {
      return {
        studentId: planned.row.studentId,
        outcome: planned.row.outcome,
        targetClassId: planned.row.targetClassId,
        status: "ALREADY_APPLIED",
        operations: planned.row.operations,
        context: {
          ...planned.row.context,
          sourceSchoolYearEnrollmentId: latestSource.id,
        },
      };
    }

    if (!planned.targetClass) {
      return null;
    }

    const targetParent =
      await this.schoolYearEnrollmentRepository.findCoveringDateByStudentAndSchoolYear(
        planned.row.studentId,
        input.targetSchoolYearId,
        input.targetEnrollmentDate,
      );
    const targetEnrollment =
      await this.enrollmentRepository.findByStudentClassDate(
        planned.row.studentId,
        planned.targetClass.id,
        input.targetEnrollmentDate,
      );

    if (!targetParent || !targetEnrollment) {
      return null;
    }

    return {
      studentId: planned.row.studentId,
      outcome: planned.row.outcome,
      targetClassId: planned.row.targetClassId,
      status: "ALREADY_APPLIED",
      operations: planned.row.operations,
      context: {
        ...planned.row.context,
        sourceSchoolYearEnrollmentId: latestSource.id,
        targetSchoolYearEnrollmentId: targetParent.id,
        targetClassEnrollmentId: targetEnrollment.id,
      },
    };
  }

  private async recordBatchCommitAudit(
    result: SchoolYearLifecycleCommitResult,
    sourceSchoolYearName: string,
    targetSchoolYearName: string,
    currentUser: User,
    input: SchoolYearLifecycleCommitInput,
  ): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "COMMIT_SCHOOL_YEAR_LIFECYCLE",
          targetType: "school_year",
          targetId: result.targetSchoolYearId,
          campusId: result.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            lifecycleRunId: input.lifecycleRunId ?? null,
            runVersion: input.runVersion ?? null,
            scopeIdentity: input.scopeIdentity ?? null,
            sourceSchoolYearId: result.sourceSchoolYearId,
            sourceSchoolYearName,
            targetSchoolYearId: result.targetSchoolYearId,
            targetSchoolYearName,
            previewRunId: result.previewRunId,
            digest: result.digest,
            rowCount: result.rows.length,
            successCount: result.rows.filter((row) => row.status === "SUCCESS")
              .length,
            failedCount: result.rows.filter((row) => row.status === "FAILED")
              .length,
            skippedCount: result.rows.filter((row) => row.status === "SKIPPED")
              .length,
            alreadyAppliedCount: result.rows.filter(
              (row) => row.status === "ALREADY_APPLIED",
            ).length,
          },
        },
        tx,
      );
    });
  }
}

function closeSchoolYearEnrollmentForLifecycle(
  source: SchoolYearEnrollment,
  exitDate: Date,
  reason: ExitReason,
  note?: string,
): SchoolYearEnrollment {
  const exitDay = toUtcDateOnly(exitDate);
  return SchoolYearEnrollment.create(
    {
      studentId: source.studentId,
      campusId: source.campusId,
      schoolYearId: source.schoolYearId,
      gradeLevelId: source.gradeLevelId,
      enrollmentDate: source.enrollmentDate,
      exitDate: exitDay,
      exitReason: reason,
      note: note ?? source.note,
      snapshotStudentFullName: source.snapshotStudentFullName,
      snapshotStudentCode: source.snapshotStudentCode,
      snapshotStudentNickname: source.snapshotStudentNickname,
      snapshotGradeLevelName: source.snapshotGradeLevelName,
      snapshotGradeLevelOrder: source.snapshotGradeLevelOrder,
      snapshotSchoolYearName: source.snapshotSchoolYearName,
      snapshotSchoolYearStartDate: source.snapshotSchoolYearStartDate,
      snapshotSchoolYearEndDate: source.snapshotSchoolYearEndDate,
      snapshotCapturedAt: source.snapshotCapturedAt,
      historicalFinalizedAt: exitDay,
      archivedAt: source.archivedAt,
      redactedAt: source.redactedAt,
      retentionExpiresAt: source.retentionExpiresAt,
      retentionPolicySource: source.retentionPolicySource,
      legalHold: source.legalHold,
      schoolYear: source.schoolYear,
      gradeLevel: source.gradeLevel,
      student: source.student,
      createdAt: source.createdAt,
      updatedAt: new Date(),
    },
    source.id,
  );
}

function closeEnrollmentForLifecycle(
  source: Enrollment,
  endDate: Date,
  reason: ExitReason,
  note?: string,
): Enrollment {
  const endDay = toUtcDateOnly(endDate);
  return Enrollment.create(
    {
      classId: source.classId,
      studentId: source.studentId,
      schoolYearEnrollmentId: source.schoolYearEnrollmentId,
      enrollmentDate: source.enrollmentDate,
      endDate: endDay,
      exitReason: reason,
      note: note ?? source.note,
      snapshotStudentFullName: source.snapshotStudentFullName,
      snapshotStudentCode: source.snapshotStudentCode,
      snapshotStudentNickname: source.snapshotStudentNickname,
      snapshotClassName: source.snapshotClassName,
      snapshotGradeLevelName: source.snapshotGradeLevelName,
      snapshotGradeLevelOrder: source.snapshotGradeLevelOrder,
      snapshotSchoolYearName: source.snapshotSchoolYearName,
      snapshotSchoolYearStartDate: source.snapshotSchoolYearStartDate,
      snapshotSchoolYearEndDate: source.snapshotSchoolYearEndDate,
      snapshotCapturedAt: source.snapshotCapturedAt,
      historicalFinalizedAt: endDay,
      archivedAt: source.archivedAt,
      redactedAt: source.redactedAt,
      retentionExpiresAt: source.retentionExpiresAt,
      retentionPolicySource: source.retentionPolicySource,
      legalHold: source.legalHold,
      class: source.class,
      student: source.student,
      schoolYearEnrollment: source.schoolYearEnrollment,
      createdAt: source.createdAt,
      updatedAt: new Date(),
    },
    source.id,
  );
}

class ExistingTargetRegistrationError extends Error {
  constructor() {
    super("EXISTING_TARGET_REGISTRATION");
    this.name = "ExistingTargetRegistrationError";
  }
}

function isUniqueConstraintPersistenceError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "P2002" ||
    candidate.code === "23505" ||
    candidate.message?.includes("unique constraint") === true
  );
}

function sameDateOnly(left: Date, right: Date): boolean {
  return toUtcDateOnly(left).getTime() === toUtcDateOnly(right).getTime();
}
