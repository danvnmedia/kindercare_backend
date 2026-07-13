import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { User } from "@/domain/user-management/user.entity";

import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  assertSchoolYearLifecycleSetup,
  SchoolYearLifecycleInvariantError,
  SchoolYearLifecycleRunDetail,
} from "../../school-year-lifecycle";
import { buildSchoolYearLifecycleRunDetail } from "./school-year-lifecycle-run-detail";

export interface UpdateSchoolYearLifecycleRunSetupInput {
  lifecycleRunId: string;
  campusId: string;
  targetSchoolYearId: string;
  sourceClosureDate: Date;
  targetEnrollmentDate: Date;
  expectedVersion: number;
}

@Injectable()
export class UpdateSchoolYearLifecycleRunSetupUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
  ) {}

  async execute(
    input: UpdateSchoolYearLifecycleRunSetupInput,
    currentUser: User,
  ): Promise<SchoolYearLifecycleRunDetail> {
    const run = await this.lifecycleRepository.findRunById(
      input.lifecycleRunId,
      input.campusId,
    );
    if (!run) {
      throw new NotFoundException("RUN_NOT_FOUND");
    }
    if (
      run.firstCommittedAt ||
      ["COMPLETED", "CANCELLED", "EXPIRED"].includes(run.status)
    ) {
      throw new ConflictException("SETUP_LOCKED");
    }

    const [sourceSchoolYear, targetSchoolYear, schoolYears] = await Promise.all(
      [
        this.schoolYearRepository.findById(run.sourceSchoolYearId),
        this.schoolYearRepository.findById(input.targetSchoolYearId),
        this.schoolYearRepository.findNonArchived(input.campusId),
      ],
    );
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
        campusId: input.campusId,
        sourceSchoolYear,
        targetSchoolYear,
        sourceClosureDate: input.sourceClosureDate,
        targetEnrollmentDate: input.targetEnrollmentDate,
        nextSchoolYearId,
      });
    } catch (error) {
      if (error instanceof SchoolYearLifecycleInvariantError) {
        throw new BadRequestException(error.code);
      }
      throw error;
    }

    const updated = await this.lifecycleRepository.updateRunVersioned({
      id: run.id,
      campusId: run.campusId,
      expectedVersion: input.expectedVersion,
      updatedByUserId: currentUser.id,
      targetSchoolYearId: input.targetSchoolYearId,
      sourceClosureDate: input.sourceClosureDate,
      targetEnrollmentDate: input.targetEnrollmentDate,
      invalidatePreviews: true,
      resetTargetAssignments:
        run.targetSchoolYearId !== input.targetSchoolYearId,
      audit: {
        actorId: currentUser.id,
        action: "UPDATE_SCHOOL_YEAR_LIFECYCLE_SETUP",
        targetType: "school_year",
        targetId: run.sourceSchoolYearId,
        campusId: input.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          lifecycleRunId: run.id,
          expectedVersion: input.expectedVersion,
          nextVersion: input.expectedVersion + 1,
        },
        beforeValue: {
          targetSchoolYearId: run.targetSchoolYearId,
          sourceClosureDate: run.sourceClosureDate.toISOString(),
          targetEnrollmentDate: run.targetEnrollmentDate.toISOString(),
        },
        afterValue: {
          targetSchoolYearId: input.targetSchoolYearId,
          sourceClosureDate: input.sourceClosureDate.toISOString(),
          targetEnrollmentDate: input.targetEnrollmentDate.toISOString(),
        },
      },
    });
    if (!updated) {
      const current = await this.lifecycleRepository.findRunById(
        run.id,
        run.campusId,
      );
      throw new ConflictException({
        code: "STALE_RUN_VERSION",
        currentVersion: current?.version ?? run.version,
        lifecycleRunId: run.id,
      });
    }

    return buildSchoolYearLifecycleRunDetail(
      updated,
      this.lifecycleRepository,
      this.schoolYearRepository,
    );
  }
}
