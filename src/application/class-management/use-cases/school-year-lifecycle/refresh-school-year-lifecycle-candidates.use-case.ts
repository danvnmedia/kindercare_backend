import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";

import { User } from "@/domain/user-management/user.entity";

import { GradeLevelRepository } from "../../ports/grade-level.repository";
import {
  ReconcileSchoolYearLifecycleCandidateInput,
  SaveSchoolYearLifecycleCandidateInput,
  SchoolYearLifecycleRepository,
} from "../../ports/school-year-lifecycle.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  SchoolYearLifecycleCandidate,
  SchoolYearLifecycleOutcome,
  SchoolYearLifecycleRunDetail,
} from "../../school-year-lifecycle";
import { buildSchoolYearLifecycleRunDetail } from "./school-year-lifecycle-run-detail";

export interface RefreshSchoolYearLifecycleCandidatesResult {
  addedCount: number;
  updatedCount: number;
  noLongerEligibleCount: number;
  run: SchoolYearLifecycleRunDetail;
}

@Injectable()
export class RefreshSchoolYearLifecycleCandidatesUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(
    input: {
      lifecycleRunId: string;
      campusId: string;
      expectedVersion: number;
    },
    currentUser: User,
  ): Promise<RefreshSchoolYearLifecycleCandidatesResult> {
    const run = await this.lifecycleRepository.findRunById(
      input.lifecycleRunId,
      input.campusId,
    );
    if (!run) {
      throw new NotFoundException("RUN_NOT_FOUND");
    }
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(run.status)) {
      throw new ConflictException("RUN_NOT_REFRESHABLE");
    }
    if (run.version !== input.expectedVersion) {
      throw new ConflictException({
        code: "STALE_RUN_VERSION",
        currentVersion: run.version,
        lifecycleRunId: run.id,
      });
    }

    const [currentCandidates, existingCandidates, gradeLevels] =
      await Promise.all([
        this.lifecycleRepository.findOpenSourceCandidates(
          input.campusId,
          run.sourceSchoolYearId,
          undefined,
          run.sourceClosureDate,
        ),
        this.lifecycleRepository.findCandidatesByRunId(run.id, input.campusId),
        this.gradeLevelRepository.findNonArchived(input.campusId),
      ]);
    const existingByStudentId = new Map(
      existingCandidates.map((candidate) => [candidate.studentId, candidate]),
    );
    const currentByStudentId = new Map(
      currentCandidates.map((candidate) => [
        candidate.schoolYearEnrollment.studentId,
        candidate,
      ]),
    );
    const highestGradeOrder = gradeLevels.at(-1)?.order ?? null;
    const nextGradeIdBySourceOrder = new Map(
      gradeLevels.map((gradeLevel) => [gradeLevel.order - 1, gradeLevel.id]),
    );

    const inserts: SaveSchoolYearLifecycleCandidateInput[] = [];
    const updates: ReconcileSchoolYearLifecycleCandidateInput[] = [];
    for (const current of currentCandidates) {
      const source = current.schoolYearEnrollment;
      const sourceOrder = source.gradeLevel?.order ?? null;
      const recommendedOutcome: SchoolYearLifecycleOutcome =
        sourceOrder !== null && sourceOrder === highestGradeOrder
          ? "GRADUATE"
          : "PROMOTE";
      const targetGradeLevelId =
        sourceOrder === null
          ? null
          : (nextGradeIdBySourceOrder.get(sourceOrder) ?? null);
      const existing = existingByStudentId.get(source.studentId);
      if (!existing) {
        inserts.push({
          id: randomUUID(),
          lifecycleRunId: run.id,
          campusId: input.campusId,
          studentId: source.studentId,
          sourceSchoolYearEnrollmentId: source.id,
          sourceEnrollmentId: current.activeEnrollment?.id ?? null,
          sourceGradeLevelId: source.gradeLevelId,
          sourceClassId: current.activeEnrollment?.classId ?? null,
          recommendedOutcome,
          status: recommendedOutcome === "GRADUATE" ? "READY" : "NOT_STARTED",
          decision: recommendedOutcome === "GRADUATE" ? "GRADUATE" : null,
          targetGradeLevelId,
        });
        continue;
      }

      if (existing.committedAt) {
        continue;
      }
      const sourceEnrollmentId = current.activeEnrollment?.id ?? null;
      const sourceClassId = current.activeEnrollment?.classId ?? null;
      const contextChanged =
        existing.sourceSchoolYearEnrollmentId !== source.id ||
        existing.sourceEnrollmentId !== sourceEnrollmentId ||
        existing.sourceGradeLevelId !== source.gradeLevelId ||
        existing.sourceClassId !== sourceClassId ||
        existing.status === "NO_LONGER_ELIGIBLE";
      if (!contextChanged) {
        continue;
      }

      const reconciled = this.reconcileDecision(
        existing,
        recommendedOutcome,
        source.gradeLevelId,
        targetGradeLevelId,
      );
      updates.push({
        id: existing.id,
        sourceSchoolYearEnrollmentId: source.id,
        sourceEnrollmentId,
        sourceGradeLevelId: source.gradeLevelId,
        sourceClassId,
        status: "NEEDS_REVIEW",
        recommendedOutcome,
        ...reconciled,
      });
    }

    let noLongerEligibleCount = 0;
    for (const existing of existingCandidates) {
      if (
        existing.committedAt ||
        currentByStudentId.has(existing.studentId) ||
        existing.status === "NO_LONGER_ELIGIBLE"
      ) {
        continue;
      }
      noLongerEligibleCount += 1;
      updates.push({
        id: existing.id,
        sourceSchoolYearEnrollmentId: existing.sourceSchoolYearEnrollmentId,
        sourceEnrollmentId: existing.sourceEnrollmentId,
        sourceGradeLevelId: existing.sourceGradeLevelId,
        sourceClassId: existing.sourceClassId,
        status: "NO_LONGER_ELIGIBLE",
        recommendedOutcome: existing.recommendedOutcome,
        decision: existing.decision,
        targetGradeLevelId: existing.targetGradeLevelId,
        targetClassId: existing.targetClassId,
      });
    }

    const persisted =
      await this.lifecycleRepository.reconcileCandidatesVersioned({
        lifecycleRunId: run.id,
        campusId: input.campusId,
        expectedVersion: input.expectedVersion,
        updatedByUserId: currentUser.id,
        inserts,
        updates,
        audit: {
          actorId: currentUser.id,
          action: "REFRESH_SCHOOL_YEAR_LIFECYCLE_CANDIDATES",
          targetType: "school_year",
          targetId: run.sourceSchoolYearId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            lifecycleRunId: run.id,
            expectedVersion: input.expectedVersion,
            nextVersion: input.expectedVersion + 1,
            addedCount: inserts.length,
            updatedCount: updates.length - noLongerEligibleCount,
            noLongerEligibleCount,
            changedCandidateIds: updates.map((candidate) => candidate.id),
          },
        },
      });
    if (!persisted) {
      const current = await this.lifecycleRepository.findRunById(
        run.id,
        input.campusId,
      );
      if (current?.version === run.version) {
        throw new ConflictException("SOURCE_REGISTRATION_CANCELLED");
      }
      throw new ConflictException({
        code: "STALE_RUN_VERSION",
        currentVersion: current?.version ?? run.version,
        lifecycleRunId: run.id,
      });
    }

    return {
      addedCount: inserts.length,
      updatedCount: updates.length - noLongerEligibleCount,
      noLongerEligibleCount,
      run: await buildSchoolYearLifecycleRunDetail(
        persisted,
        this.lifecycleRepository,
        this.schoolYearRepository,
      ),
    };
  }

  private reconcileDecision(
    existing: SchoolYearLifecycleCandidate,
    recommendedOutcome: SchoolYearLifecycleOutcome,
    sourceGradeLevelId: string,
    targetGradeLevelId: string | null,
  ): {
    decision: SchoolYearLifecycleOutcome | null;
    targetGradeLevelId: string | null;
    targetClassId: string | null;
  } {
    if (existing.decision === "SKIP") {
      return {
        decision: "SKIP",
        targetGradeLevelId: null,
        targetClassId: null,
      };
    }
    if (existing.decision === "GRADUATE") {
      return recommendedOutcome === "GRADUATE"
        ? {
            decision: "GRADUATE",
            targetGradeLevelId: null,
            targetClassId: null,
          }
        : {
            decision: null,
            targetGradeLevelId,
            targetClassId: null,
          };
    }
    if (existing.decision === "RETAIN") {
      const assignmentCompatible =
        existing.targetGradeLevelId === sourceGradeLevelId;
      return {
        decision: "RETAIN",
        targetGradeLevelId: sourceGradeLevelId,
        targetClassId: assignmentCompatible ? existing.targetClassId : null,
      };
    }
    if (existing.decision === "PROMOTE") {
      const assignmentCompatible =
        existing.targetGradeLevelId === targetGradeLevelId;
      return {
        decision: "PROMOTE",
        targetGradeLevelId,
        targetClassId: assignmentCompatible ? existing.targetClassId : null,
      };
    }
    return {
      decision: null,
      targetGradeLevelId,
      targetClassId: null,
    };
  }
}
