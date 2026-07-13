import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";

import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { User } from "@/domain/user-management/user.entity";

import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  buildSchoolYearLifecycleDigest,
  SchoolYearLifecyclePreviewInput,
  SchoolYearLifecyclePreviewResult,
  toCanonicalLifecycleInput,
  toSerializableLifecyclePreviewResult,
} from "../../school-year-lifecycle";
import { buildSchoolYearLifecyclePlan } from "./school-year-lifecycle-planner";

@Injectable()
export class PreviewSchoolYearLifecycleUseCase {
  private readonly logger = new Logger(PreviewSchoolYearLifecycleUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(
    input: SchoolYearLifecyclePreviewInput,
    currentUser: User,
  ): Promise<SchoolYearLifecyclePreviewResult> {
    if (input.rows.length === 0) {
      throw new BadRequestException("EXPLICIT_ROWS_REQUIRED");
    }
    if (input.sourceSchoolYearId === input.targetSchoolYearId) {
      throw new BadRequestException("IDENTICAL_SCHOOL_YEARS");
    }
    this.assertNoDuplicateStudents(input.rows.map((row) => row.studentId));

    const sourceSchoolYear = await this.schoolYearRepository.findById(
      input.sourceSchoolYearId,
    );
    if (!sourceSchoolYear || sourceSchoolYear.campusId !== input.campusId) {
      throw new NotFoundException("SOURCE_SCHOOL_YEAR_NOT_FOUND");
    }

    const targetSchoolYear = await this.schoolYearRepository.findById(
      input.targetSchoolYearId,
    );
    if (!targetSchoolYear || targetSchoolYear.campusId !== input.campusId) {
      throw new NotFoundException("TARGET_SCHOOL_YEAR_NOT_FOUND");
    }

    const plan = await buildSchoolYearLifecyclePlan(
      input,
      sourceSchoolYear,
      targetSchoolYear,
      {
        lifecycleRepository: this.lifecycleRepository,
        schoolYearEnrollmentRepository: this.schoolYearEnrollmentRepository,
        classRepository: this.classRepository,
      },
    );
    const persistedInput: SchoolYearLifecyclePreviewInput = {
      ...input,
      rows: plan.rows.map((planned) => ({
        studentId: planned.row.studentId,
        outcome: planned.row.outcome,
        targetClassId: planned.row.targetClassId,
        note: planned.input.note,
      })),
    };
    const digest = buildSchoolYearLifecycleDigest(persistedInput);
    const previewRunId = randomUUID();

    const result: SchoolYearLifecyclePreviewResult = {
      previewRunId,
      digest,
      campusId: input.campusId,
      sourceSchoolYearId: input.sourceSchoolYearId,
      targetSchoolYearId: input.targetSchoolYearId,
      sourceClosureDate: input.sourceClosureDate,
      targetEnrollmentDate: input.targetEnrollmentDate,
      rows: plan.rows.map((planned) => planned.row),
    };

    await this.transactionRunner.run(async (tx) => {
      await this.lifecycleRepository.savePreviewRun(
        {
          id: previewRunId,
          campusId: input.campusId,
          sourceSchoolYearId: input.sourceSchoolYearId,
          targetSchoolYearId: input.targetSchoolYearId,
          sourceClosureDate: input.sourceClosureDate,
          targetEnrollmentDate: input.targetEnrollmentDate,
          digest,
          requestPayload: toCanonicalLifecycleInput(persistedInput),
          resultPayload: toSerializableLifecyclePreviewResult(result),
          createdByUserId: currentUser.id,
        },
        tx,
      );
      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "PREVIEW_SCHOOL_YEAR_LIFECYCLE",
          targetType: "school_year",
          targetId: input.targetSchoolYearId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            sourceSchoolYearId: input.sourceSchoolYearId,
            sourceSchoolYearName: sourceSchoolYear.name,
            targetSchoolYearId: input.targetSchoolYearId,
            targetSchoolYearName: targetSchoolYear.name,
            previewRunId,
            digest,
            rowCount: result.rows.length,
            readyCount: result.rows.filter((row) => row.status === "READY")
              .length,
            conflictCount: result.rows.filter(
              (row) => row.status === "CONFLICT",
            ).length,
            skippedCount: result.rows.filter((row) => row.status === "SKIPPED")
              .length,
          },
        },
        tx,
      );
    });

    this.logger.log(
      `School-year lifecycle preview ${previewRunId}: campus=${input.campusId} rows=${result.rows.length}`,
    );
    return result;
  }

  private assertNoDuplicateStudents(studentIds: string[]): void {
    const seen = new Set<string>();
    for (const studentId of studentIds) {
      if (seen.has(studentId)) {
        throw new BadRequestException("DUPLICATE_STUDENT_IN_BATCH");
      }
      seen.add(studentId);
    }
  }
}
