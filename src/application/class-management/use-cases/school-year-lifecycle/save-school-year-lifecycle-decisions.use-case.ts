import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";

import { User } from "@/domain/user-management/user.entity";

import { ClassRepository } from "../../ports/class.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import {
  SchoolYearLifecycleDecisionInput,
  SchoolYearLifecycleDecisionSaveResult,
} from "../../school-year-lifecycle";
import { validateSchoolYearLifecycleDecisions } from "./school-year-lifecycle-decision-validator";

@Injectable()
export class SaveSchoolYearLifecycleDecisionsUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
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
      decisions: SchoolYearLifecycleDecisionInput[];
    },
    currentUser: User,
  ): Promise<SchoolYearLifecycleDecisionSaveResult> {
    if (input.decisions.length === 0 || input.decisions.length > 500) {
      throw new BadRequestException("INVALID_DECISION_BATCH_SIZE");
    }
    const candidateIds = input.decisions.map(
      (decision) => decision.candidateId,
    );
    if (new Set(candidateIds).size !== candidateIds.length) {
      throw new BadRequestException("DUPLICATE_CANDIDATE_IN_BATCH");
    }
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
    this.assertCurrentVersion(run.version, input.expectedVersion, run.id);

    const targetClassIds = [
      ...new Set(
        input.decisions
          .map((decision) => decision.targetClassId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [candidates, targetClasses, gradeLevels] = await Promise.all([
      this.lifecycleRepository.findCandidatesByIds(
        run.id,
        input.campusId,
        candidateIds,
      ),
      this.classRepository.findByIds(targetClassIds),
      this.gradeLevelRepository.findNonArchived(input.campusId),
    ]);
    const { accepted, rejected } = validateSchoolYearLifecycleDecisions({
      campusId: input.campusId,
      targetSchoolYearId: run.targetSchoolYearId,
      candidates,
      decisions: input.decisions,
      targetClasses,
      gradeLevels,
    });

    let version = run.version;
    const scopeIdentity = this.buildScopeIdentity("EXPLICIT", candidateIds);
    if (accepted.length > 0) {
      const updated = await this.lifecycleRepository.saveDecisionsVersioned({
        lifecycleRunId: run.id,
        campusId: input.campusId,
        expectedVersion: input.expectedVersion,
        updatedByUserId: currentUser.id,
        decisions: accepted,
        audit: {
          actorId: currentUser.id,
          action: "SAVE_SCHOOL_YEAR_LIFECYCLE_DECISIONS",
          targetType: "school_year",
          targetId: run.sourceSchoolYearId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            lifecycleRunId: run.id,
            mode: "INDIVIDUAL",
            scopeIdentity,
            expectedVersion: input.expectedVersion,
            nextVersion: input.expectedVersion + 1,
            affectedCount: accepted.length,
            rejectedCount: rejected.length,
            candidateIds: accepted.map((decision) => decision.candidateId),
          },
        },
      });
      if (!updated) {
        await this.throwStaleVersion(run.id, input.campusId, candidateIds);
      }
      version = updated!.version;
    }

    return {
      lifecycleRunId: run.id,
      scopeIdentity,
      affectedCount: accepted.length,
      rejectedCount: rejected.length,
      rejected,
      version,
    };
  }

  private assertCurrentVersion(
    currentVersion: number,
    expectedVersion: number,
    lifecycleRunId: string,
  ): void {
    if (currentVersion !== expectedVersion) {
      throw new ConflictException({
        code: "STALE_RUN_VERSION",
        currentVersion,
        lifecycleRunId,
      });
    }
  }

  private async throwStaleVersion(
    lifecycleRunId: string,
    campusId: string,
    candidateIds: string[],
  ): Promise<never> {
    const [currentRun, currentCandidates] = await Promise.all([
      this.lifecycleRepository.findRunById(lifecycleRunId, campusId),
      this.lifecycleRepository.findCandidatesByIds(
        lifecycleRunId,
        campusId,
        candidateIds,
      ),
    ]);
    throw new ConflictException({
      code: "STALE_RUN_VERSION",
      currentVersion: currentRun?.version,
      lifecycleRunId,
      currentRows: currentCandidates.map((candidate) => ({
        candidateId: candidate.id,
        rowVersion: candidate.rowVersion,
        status: candidate.status,
        decision: candidate.decision,
        targetClassId: candidate.targetClassId,
      })),
    });
  }

  private buildScopeIdentity(type: string, candidateIds: string[]): string {
    return createHash("sha256")
      .update(JSON.stringify({ type, candidateIds: [...candidateIds].sort() }))
      .digest("hex");
  }
}
