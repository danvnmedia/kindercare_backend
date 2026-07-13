import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { SchoolYearLifecycleRunDetail } from "../../school-year-lifecycle";
import { buildSchoolYearLifecycleRunDetail } from "./school-year-lifecycle-run-detail";

@Injectable()
export class GetSchoolYearLifecycleRunUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
  ) {}

  async execute(
    lifecycleRunId: string,
    campusId: string,
  ): Promise<SchoolYearLifecycleRunDetail> {
    const run = await this.lifecycleRepository.findRunById(
      lifecycleRunId,
      campusId,
    );
    if (!run) {
      throw new NotFoundException("RUN_NOT_FOUND");
    }

    return buildSchoolYearLifecycleRunDetail(
      run,
      this.lifecycleRepository,
      this.schoolYearRepository,
    );
  }
}
