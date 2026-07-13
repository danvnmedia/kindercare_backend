import {
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
  SchoolYearLifecycleCandidateFilter,
  SchoolYearLifecycleDecisionSaveResult,
  SchoolYearLifecycleOutcome,
} from "../../school-year-lifecycle";
import { validateSchoolYearLifecycleDecisions } from "./school-year-lifecycle-decision-validator";

@Injectable()
export class BulkSaveSchoolYearLifecycleDecisionsUseCase {
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
      filter: SchoolYearLifecycleCandidateFilter;
      outcome: SchoolYearLifecycleOutcome;
      targetClassId?: string;
      note?: string;
    },
    currentUser: User,
  ): Promise<SchoolYearLifecycleDecisionSaveResult> {
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
        currentVersion: run.version,
        lifecycleRunId: run.id,
      });
    }

    const [candidates, targetClasses, gradeLevels] = await Promise.all([
      this.lifecycleRepository.findCandidatesByFilter(
        run.id,
        input.campusId,
        input.filter,
      ),
      input.targetClassId
        ? this.classRepository.findByIds([input.targetClassId])
        : Promise.resolve([]),
      this.gradeLevelRepository.findNonArchived(input.campusId),
    ]);
    const decisions = candidates.map((candidate) => ({
      candidateId: candidate.id,
      outcome: input.outcome,
      targetClassId: input.targetClassId,
      note: input.note,
    }));
    const { accepted, rejected } = validateSchoolYearLifecycleDecisions({
      campusId: input.campusId,
      targetSchoolYearId: run.targetSchoolYearId,
      candidates,
      decisions,
      targetClasses,
      gradeLevels,
    });

    let version = run.version;
    const scopeIdentity = this.buildScopeIdentity(
      input.filter,
      candidates.map((candidate) => candidate.id),
    );
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
            mode: "BULK_FILTER",
            scopeIdentity,
            filter: input.filter,
            expectedVersion: input.expectedVersion,
            nextVersion: input.expectedVersion + 1,
            matchedCount: candidates.length,
            affectedCount: accepted.length,
            rejectedCount: rejected.length,
          },
        },
      });
      if (!updated) {
        const current = await this.lifecycleRepository.findRunById(
          run.id,
          input.campusId,
        );
        throw new ConflictException({
          code: "STALE_RUN_VERSION",
          currentVersion: current?.version,
          lifecycleRunId: run.id,
        });
      }
      version = updated.version;
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

  private buildScopeIdentity(
    filter: SchoolYearLifecycleCandidateFilter,
    candidateIds: string[],
  ): string {
    return createHash("sha256")
      .update(
        JSON.stringify({
          type: "FILTER",
          filter: {
            search: filter.search ?? null,
            sourceGradeLevelId: filter.sourceGradeLevelId ?? null,
            sourceClassId:
              filter.sourceClassId === undefined
                ? "__ANY__"
                : filter.sourceClassId,
            status: filter.status ?? null,
          },
          candidateIds: [...candidateIds].sort(),
        }),
      )
      .digest("hex");
  }
}
