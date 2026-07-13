import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import {
  SchoolYearLifecycleCandidateListQuery,
  SchoolYearLifecycleCandidatePage,
} from "../../school-year-lifecycle";

@Injectable()
export class GetSchoolYearLifecycleCandidatesUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
  ) {}

  async execute(
    lifecycleRunId: string,
    campusId: string,
    query: SchoolYearLifecycleCandidateListQuery,
  ): Promise<SchoolYearLifecycleCandidatePage> {
    if (query.offset < 0 || query.limit < 1 || query.limit > 50) {
      throw new BadRequestException("INVALID_PAGINATION");
    }
    const run = await this.lifecycleRepository.findRunById(
      lifecycleRunId,
      campusId,
    );
    if (!run) {
      throw new NotFoundException("RUN_NOT_FOUND");
    }

    return this.lifecycleRepository.findCandidatePage(
      lifecycleRunId,
      campusId,
      query,
    );
  }
}
