import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import {
  buildSchoolYearLifecycleProgress,
  SchoolYearLifecycleGradeProgress,
  SchoolYearLifecycleProgressCounts,
} from "../../school-year-lifecycle";

export interface SchoolYearLifecycleProgressResult {
  lifecycleRunId: string;
  version: number;
  status: string;
  totals: SchoolYearLifecycleProgressCounts;
  grades: SchoolYearLifecycleGradeProgress[];
}

@Injectable()
export class GetSchoolYearLifecycleProgressUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
  ) {}

  async execute(
    lifecycleRunId: string,
    campusId: string,
  ): Promise<SchoolYearLifecycleProgressResult> {
    const run = await this.lifecycleRepository.findRunById(
      lifecycleRunId,
      campusId,
    );
    if (!run) {
      throw new NotFoundException("RUN_NOT_FOUND");
    }
    const aggregates = await this.lifecycleRepository.findCandidateAggregates(
      lifecycleRunId,
      campusId,
    );

    return {
      lifecycleRunId,
      version: run.version,
      status: run.status,
      ...buildSchoolYearLifecycleProgress(aggregates),
    };
  }
}
