import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "crypto";

import { User } from "@/domain/user-management/user.entity";

import { ClassRepository } from "../../ports/class.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  RunScopedSchoolYearLifecyclePreviewResult,
  SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES,
  SchoolYearLifecycleCandidate,
  SchoolYearLifecyclePreviewBatch,
  SchoolYearLifecyclePreviewInput,
  SchoolYearLifecyclePreviewScope,
  toCanonicalLifecycleInput,
  toSerializableLifecyclePreviewResult,
} from "../../school-year-lifecycle";
import { buildSchoolYearLifecyclePlan } from "./school-year-lifecycle-planner";

@Injectable()
export class PreviewSchoolYearLifecycleRunUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(
    input: {
      lifecycleRunId: string;
      campusId: string;
      expectedVersion: number;
      scope: SchoolYearLifecyclePreviewScope;
    },
    currentUser: User,
  ): Promise<RunScopedSchoolYearLifecyclePreviewResult> {
    const run = await this.lifecycleRepository.findRunById(
      input.lifecycleRunId,
      input.campusId,
    );
    if (!run) {
      throw new NotFoundException("RUN_NOT_FOUND");
    }
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(run.status)) {
      throw new ConflictException("RUN_NOT_EDITABLE");
    }
    if (run.version !== input.expectedVersion) {
      throw new ConflictException({
        code: "STALE_RUN_VERSION",
        lifecycleRunId: run.id,
        currentVersion: run.version,
      });
    }

    const candidates = await this.resolveScope(run, input.scope);
    if (candidates.length === 0) {
      throw new BadRequestException("INVALID_SCOPE");
    }
    const selectedCandidates = this.applyScopeLimit(candidates, input.scope);
    const unresolved = selectedCandidates.filter(
      (candidate) =>
        !candidate.decision ||
        [
          "NOT_STARTED",
          "NEEDS_ACTION",
          "NEEDS_REVIEW",
          "NO_LONGER_ELIGIBLE",
          "COMMITTED",
          "ALREADY_APPLIED",
        ].includes(candidate.status),
    );
    if (unresolved.length > 0) {
      throw new BadRequestException({
        code: "UNRESOLVED_CANDIDATES",
        candidateIds: unresolved.map((candidate) => candidate.id),
      });
    }

    const [sourceSchoolYear, targetSchoolYear] = await Promise.all([
      this.schoolYearRepository.findById(run.sourceSchoolYearId),
      this.schoolYearRepository.findById(run.targetSchoolYearId),
    ]);
    if (
      !sourceSchoolYear ||
      sourceSchoolYear.campusId !== input.campusId ||
      !targetSchoolYear ||
      targetSchoolYear.campusId !== input.campusId
    ) {
      throw new NotFoundException("RUN_SCHOOL_YEAR_NOT_FOUND");
    }

    const previewInput: SchoolYearLifecyclePreviewInput = {
      campusId: input.campusId,
      sourceSchoolYearId: run.sourceSchoolYearId,
      targetSchoolYearId: run.targetSchoolYearId,
      sourceClosureDate: run.sourceClosureDate,
      targetEnrollmentDate: run.targetEnrollmentDate,
      rows: selectedCandidates.map((candidate) => ({
        studentId: candidate.studentId,
        outcome: candidate.decision ?? undefined,
        targetClassId: candidate.targetClassId ?? undefined,
        note: candidate.decisionNote ?? undefined,
      })),
    };
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
    const scopeIdentity = this.buildScopeIdentity(
      input.scope,
      selectedCandidates,
    );
    const digest = createHash("sha256")
      .update(
        JSON.stringify({
          lifecycleRunId: run.id,
          runVersion: run.version,
          scopeIdentity,
          input: toCanonicalLifecycleInput(previewInput),
        }),
      )
      .digest("hex");
    const previewRunId = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const result: RunScopedSchoolYearLifecyclePreviewResult = {
      previewRunId,
      digest,
      lifecycleRunId: run.id,
      runVersion: run.version,
      scopeType: input.scope.type,
      scopeIdentity,
      expiresAt,
      campusId: run.campusId,
      sourceSchoolYearId: run.sourceSchoolYearId,
      targetSchoolYearId: run.targetSchoolYearId,
      sourceClosureDate: run.sourceClosureDate,
      targetEnrollmentDate: run.targetEnrollmentDate,
      rows: plan.rows.map((planned) => planned.row),
      summary: {
        rowCount: plan.rows.length,
        readyCount: plan.rows.filter(
          (planned) => planned.row.status === "READY",
        ).length,
        conflictCount: plan.rows.filter(
          (planned) => planned.row.status === "CONFLICT",
        ).length,
        skippedCount: plan.rows.filter(
          (planned) => planned.row.status === "SKIPPED",
        ).length,
      },
    };
    const candidateByStudentId = new Map(
      selectedCandidates.map((candidate) => [candidate.studentId, candidate]),
    );
    const persisted = await this.lifecycleRepository.saveRunScopedPreview({
      id: previewRunId,
      lifecycleRunId: run.id,
      runVersion: run.version,
      campusId: run.campusId,
      sourceSchoolYearId: run.sourceSchoolYearId,
      targetSchoolYearId: run.targetSchoolYearId,
      sourceClosureDate: run.sourceClosureDate,
      targetEnrollmentDate: run.targetEnrollmentDate,
      digest,
      requestPayload: {
        lifecycleRunId: run.id,
        runVersion: run.version,
        scope: input.scope,
        normalizedInput: toCanonicalLifecycleInput(previewInput),
      },
      resultPayload: toSerializableLifecyclePreviewResult(result),
      scopeType: input.scope.type,
      scopeIdentity,
      scopePayload: input.scope,
      expiresAt,
      createdByUserId: currentUser.id,
      candidates: plan.rows.map((planned, sequence) => {
        const candidate = candidateByStudentId.get(planned.row.studentId)!;
        return {
          candidateId: candidate.id,
          sequence,
          normalizedRow: planned.row,
          status: planned.row.status === "CONFLICT" ? "CONFLICT" : "PREVIEWED",
          conflictCode: planned.row.conflictCode ?? null,
          message: planned.row.conflictCode ?? null,
        };
      }),
      audit: {
        actorId: currentUser.id,
        action: "PREVIEW_SCHOOL_YEAR_LIFECYCLE",
        targetType: "school_year",
        targetId: run.targetSchoolYearId,
        campusId: run.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          lifecycleRunId: run.id,
          runVersion: run.version,
          previewRunId,
          scopeType: input.scope.type,
          scopeIdentity,
          digest,
          rowCount: result.summary.rowCount,
          readyCount: result.summary.readyCount,
          conflictCount: result.summary.conflictCount,
          expiresAt: expiresAt.toISOString(),
        },
      },
    });
    if (!persisted) {
      const current = await this.lifecycleRepository.findRunById(
        run.id,
        run.campusId,
      );
      if (current?.version === run.version) {
        throw new ConflictException("SOURCE_REGISTRATION_CANCELLED");
      }
      throw new ConflictException({
        code: "STALE_RUN_VERSION",
        lifecycleRunId: run.id,
        currentVersion: current?.version,
      });
    }

    return result;
  }

  private async resolveScope(
    run: {
      id: string;
      campusId: string;
      sourceSchoolYearId: string;
    },
    scope: SchoolYearLifecyclePreviewScope,
  ): Promise<SchoolYearLifecycleCandidate[]> {
    if (
      scope.batchIndex !== undefined &&
      (scope.type !== "CLASSES" || scope.classIds?.length !== 1)
    ) {
      throw new BadRequestException("INVALID_SCOPE");
    }
    let candidates: SchoolYearLifecycleCandidate[];
    if (scope.type === "STUDENTS") {
      const candidateIds = scope.candidateIds ?? [];
      if (
        candidateIds.length === 0 ||
        new Set(candidateIds).size !== candidateIds.length
      ) {
        throw new BadRequestException("INVALID_SCOPE");
      }
      candidates = await this.lifecycleRepository.findCandidatesByIds(
        run.id,
        run.campusId,
        candidateIds,
      );
      if (candidates.length !== candidateIds.length) {
        throw new BadRequestException("INVALID_SCOPE");
      }
    } else if (scope.type === "GRADE") {
      if (!scope.gradeLevelId) {
        throw new BadRequestException("INVALID_SCOPE");
      }
      const gradeLevel = await this.gradeLevelRepository.findById(
        scope.gradeLevelId,
      );
      if (!gradeLevel || gradeLevel.campusId !== run.campusId) {
        throw new BadRequestException("INVALID_SCOPE");
      }
      candidates = await this.lifecycleRepository.findCandidatesByFilter(
        run.id,
        run.campusId,
        { sourceGradeLevelId: scope.gradeLevelId },
      );
    } else {
      const classIds = scope.classIds ?? [];
      if (classIds.length === 0 || new Set(classIds).size !== classIds.length) {
        throw new BadRequestException("INVALID_SCOPE");
      }
      const classes = await this.classRepository.findByIds(classIds);
      if (
        classes.length !== classIds.length ||
        classes.some(
          (classEntity) =>
            classEntity.campusId !== run.campusId ||
            classEntity.schoolYearId !== run.sourceSchoolYearId,
        ) ||
        new Set(classes.map((classEntity) => classEntity.gradeLevelId)).size !==
          1
      ) {
        throw new BadRequestException("INVALID_SCOPE");
      }
      candidates =
        await this.lifecycleRepository.findCandidatesBySourceClassIds(
          run.id,
          run.campusId,
          classIds,
        );
    }

    return [...candidates].sort(
      (left, right) =>
        (left.sourceClassId ?? "").localeCompare(right.sourceClassId ?? "") ||
        left.studentId.localeCompare(right.studentId) ||
        left.id.localeCompare(right.id),
    );
  }

  private applyScopeLimit(
    candidates: SchoolYearLifecycleCandidate[],
    scope: SchoolYearLifecyclePreviewScope,
  ): SchoolYearLifecycleCandidate[] {
    if (
      scope.type === "CLASSES" &&
      scope.classIds?.length === 1 &&
      scope.batchIndex !== undefined
    ) {
      const totalBatches = Math.ceil(
        candidates.length / SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES,
      );
      if (scope.batchIndex < 0 || scope.batchIndex >= totalBatches) {
        throw new BadRequestException("INVALID_SCOPE");
      }
      const start =
        scope.batchIndex * SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES;
      return candidates.slice(
        start,
        start + SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES,
      );
    }

    if (candidates.length <= SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES) {
      return candidates;
    }

    const classGroups = new Map<string, SchoolYearLifecycleCandidate[]>();
    for (const candidate of candidates) {
      const classId = candidate.sourceClassId ?? "UNASSIGNED";
      const group = classGroups.get(classId) ?? [];
      group.push(candidate);
      classGroups.set(classId, group);
    }
    const batches: SchoolYearLifecyclePreviewBatch[] = [];
    for (const [classId, group] of classGroups) {
      if (classId === "UNASSIGNED") {
        continue;
      }
      const totalBatches = Math.ceil(
        group.length / SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES,
      );
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
        const batchCandidates = group.slice(
          batchIndex * SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES,
          (batchIndex + 1) * SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES,
        );
        batches.push({
          batchId: createHash("sha256")
            .update(
              JSON.stringify({
                classId,
                batchIndex,
                candidateIds: batchCandidates.map((candidate) => candidate.id),
              }),
            )
            .digest("hex"),
          classId,
          batchIndex,
          totalBatches,
          candidateCount: batchCandidates.length,
        });
      }
    }
    throw new BadRequestException({
      code: "SCOPE_TOO_LARGE",
      maximum: SCHOOL_YEAR_LIFECYCLE_MAX_PREVIEW_CANDIDATES,
      candidateCount: candidates.length,
      classCounts: [...classGroups].map(([classId, group]) => ({
        classId: classId === "UNASSIGNED" ? null : classId,
        candidateCount: group.length,
      })),
      batches,
    });
  }

  private buildScopeIdentity(
    scope: SchoolYearLifecyclePreviewScope,
    candidates: SchoolYearLifecycleCandidate[],
  ): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          type: scope.type,
          gradeLevelId: scope.gradeLevelId ?? null,
          classIds: [...(scope.classIds ?? [])].sort(),
          candidateIds: candidates.map((candidate) => candidate.id).sort(),
          batchIndex: scope.batchIndex ?? null,
        }),
      )
      .digest("hex");
  }
}
