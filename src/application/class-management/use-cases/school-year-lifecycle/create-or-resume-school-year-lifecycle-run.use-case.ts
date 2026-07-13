import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "crypto";

import { User } from "@/domain/user-management/user.entity";

import { GradeLevelRepository } from "../../ports/grade-level.repository";
import {
  SaveSchoolYearLifecycleCandidateInput,
  SchoolYearLifecycleRepository,
} from "../../ports/school-year-lifecycle.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  assertSchoolYearLifecycleSetup,
  SchoolYearLifecycleInvariantError,
  SchoolYearLifecycleRunDetail,
} from "../../school-year-lifecycle";
import { buildSchoolYearLifecycleRunDetail } from "./school-year-lifecycle-run-detail";

export interface CreateOrResumeSchoolYearLifecycleRunInput {
  campusId: string;
  sourceSchoolYearId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
}

@Injectable()
export class CreateOrResumeSchoolYearLifecycleRunUseCase {
  private readonly logger = new Logger(
    CreateOrResumeSchoolYearLifecycleRunUseCase.name,
  );

  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(
    input: CreateOrResumeSchoolYearLifecycleRunInput,
    currentUser: User,
  ): Promise<SchoolYearLifecycleRunDetail> {
    const [sourceSchoolYear, targetSchoolYear, schoolYears, gradeLevels] =
      await Promise.all([
        this.schoolYearRepository.findById(input.sourceSchoolYearId),
        this.schoolYearRepository.findById(input.targetSchoolYearId),
        this.schoolYearRepository.findNonArchived(input.campusId),
        this.gradeLevelRepository.findNonArchived(input.campusId),
      ]);

    if (
      !sourceSchoolYear ||
      sourceSchoolYear.campusId !== input.campusId ||
      !targetSchoolYear ||
      targetSchoolYear.campusId !== input.campusId
    ) {
      throw new NotFoundException("SCHOOL_YEAR_NOT_FOUND");
    }

    const nextSchoolYearId =
      [...schoolYears]
        .filter(
          (schoolYear) =>
            schoolYear.startDate.getTime() > sourceSchoolYear.endDate.getTime(),
        )
        .sort(
          (left, right) => left.startDate.getTime() - right.startDate.getTime(),
        )[0]?.id ?? null;

    try {
      assertSchoolYearLifecycleSetup({
        ...input,
        sourceSchoolYear,
        targetSchoolYear,
        nextSchoolYearId,
      });
    } catch (error) {
      if (error instanceof SchoolYearLifecycleInvariantError) {
        throw new BadRequestException(error.code);
      }
      throw error;
    }

    const activeRun = await this.lifecycleRepository.findActiveRun(
      input.campusId,
      input.sourceSchoolYearId,
    );
    if (activeRun) {
      this.logger.log(
        `Resumed school-year lifecycle run ${activeRun.id} for campus ${input.campusId}`,
      );
      return buildSchoolYearLifecycleRunDetail(
        activeRun,
        this.lifecycleRepository,
        this.schoolYearRepository,
      );
    }

    const sourceCandidates =
      await this.lifecycleRepository.findOpenSourceCandidates(
        input.campusId,
        input.sourceSchoolYearId,
        undefined,
        input.sourceClosureDate,
      );
    const runId = randomUUID();
    const highestGradeOrder = gradeLevels.at(-1)?.order ?? null;
    const nextGradeIdByOrder = new Map(
      gradeLevels.map((gradeLevel) => [gradeLevel.order - 1, gradeLevel.id]),
    );
    const candidates: SaveSchoolYearLifecycleCandidateInput[] =
      sourceCandidates.map(({ schoolYearEnrollment, activeEnrollment }) => {
        const sourceOrder = schoolYearEnrollment.gradeLevel?.order ?? null;
        const isHighestGrade =
          sourceOrder !== null && sourceOrder === highestGradeOrder;
        return {
          id: randomUUID(),
          lifecycleRunId: runId,
          campusId: input.campusId,
          studentId: schoolYearEnrollment.studentId,
          sourceSchoolYearEnrollmentId: schoolYearEnrollment.id,
          sourceEnrollmentId: activeEnrollment?.id ?? null,
          sourceGradeLevelId: schoolYearEnrollment.gradeLevelId,
          sourceClassId: activeEnrollment?.classId ?? null,
          recommendedOutcome: isHighestGrade ? "GRADUATE" : "PROMOTE",
          status: isHighestGrade ? "READY" : "NOT_STARTED",
          decision: isHighestGrade ? "GRADUATE" : null,
          targetGradeLevelId:
            sourceOrder === null
              ? null
              : (nextGradeIdByOrder.get(sourceOrder) ?? null),
        };
      });

    const { run, created } = await this.lifecycleRepository.findOrCreateRun(
      {
        id: runId,
        campusId: input.campusId,
        sourceSchoolYearId: input.sourceSchoolYearId,
        targetSchoolYearId: input.targetSchoolYearId,
        sourceClosureDate: input.sourceClosureDate,
        targetEnrollmentDate: input.targetEnrollmentDate,
        createdByUserId: currentUser.id,
        audit: {
          actorId: currentUser.id,
          action: "CREATE_SCHOOL_YEAR_LIFECYCLE_RUN",
          targetType: "school_year",
          targetId: input.sourceSchoolYearId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            lifecycleRunId: runId,
            runVersion: 1,
            sourceSchoolYearId: input.sourceSchoolYearId,
            targetSchoolYearId: input.targetSchoolYearId,
            sourceClosureDate: input.sourceClosureDate.toISOString(),
            targetEnrollmentDate: input.targetEnrollmentDate.toISOString(),
          },
        },
      },
      candidates,
    );

    this.logger.log(
      `${created ? "Created" : "Resumed"} school-year lifecycle run ${run.id} for campus ${input.campusId}`,
    );
    return buildSchoolYearLifecycleRunDetail(
      run,
      this.lifecycleRepository,
      this.schoolYearRepository,
    );
  }
}
