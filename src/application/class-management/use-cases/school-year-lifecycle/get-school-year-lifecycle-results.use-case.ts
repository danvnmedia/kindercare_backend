import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { SchoolYearLifecycleCommitAttemptResult } from "../../school-year-lifecycle";

@Injectable()
export class GetSchoolYearLifecycleResultsUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
  ) {}

  async execute(
    lifecycleRunId: string,
    campusId: string,
    limit = 20,
  ): Promise<SchoolYearLifecycleCommitAttemptResult[]> {
    const run = await this.lifecycleRepository.findRunById(
      lifecycleRunId,
      campusId,
    );
    if (!run) {
      throw new NotFoundException("RUN_NOT_FOUND");
    }
    return this.lifecycleRepository.findCommitAttempts(
      lifecycleRunId,
      campusId,
      limit,
    );
  }
}
