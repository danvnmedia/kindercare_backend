import { NotFoundException } from "@nestjs/common";

import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import {
  buildSchoolYearLifecycleProgress,
  SchoolYearLifecycleRun,
  SchoolYearLifecycleRunDetail,
} from "../../school-year-lifecycle";

export async function buildSchoolYearLifecycleRunDetail(
  run: SchoolYearLifecycleRun,
  lifecycleRepository: SchoolYearLifecycleRepository,
  schoolYearRepository: SchoolYearRepository,
): Promise<SchoolYearLifecycleRunDetail> {
  const [sourceSchoolYear, targetSchoolYear, aggregates] = await Promise.all([
    schoolYearRepository.findById(run.sourceSchoolYearId),
    schoolYearRepository.findById(run.targetSchoolYearId),
    lifecycleRepository.findCandidateAggregates(run.id, run.campusId),
  ]);

  if (
    !sourceSchoolYear ||
    sourceSchoolYear.campusId !== run.campusId ||
    !targetSchoolYear ||
    targetSchoolYear.campusId !== run.campusId
  ) {
    throw new NotFoundException("RUN_SCHOOL_YEAR_NOT_FOUND");
  }

  const progress = buildSchoolYearLifecycleProgress(aggregates);
  return {
    run,
    sourceSchoolYear: {
      id: sourceSchoolYear.id,
      name: sourceSchoolYear.name,
      startDate: sourceSchoolYear.startDate,
      endDate: sourceSchoolYear.endDate,
    },
    targetSchoolYear: {
      id: targetSchoolYear.id,
      name: targetSchoolYear.name,
      startDate: targetSchoolYear.startDate,
      endDate: targetSchoolYear.endDate,
    },
    ...progress,
  };
}
