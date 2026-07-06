import { Inject, Injectable } from "@nestjs/common";

import { WeeklyPlanRepository } from "@/application/weekly-plan/ports";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { WeeklyPlan } from "@/domain/weekly-plan";

export interface GetWeeklyPlansInput {
  campusId: string;
  params: StandardRequest;
}

@Injectable()
export class GetWeeklyPlansUseCase {
  constructor(
    @Inject("WEEKLY_PLAN_REPOSITORY")
    private readonly weeklyPlanRepository: WeeklyPlanRepository,
  ) {}

  async execute(
    input: GetWeeklyPlansInput,
  ): Promise<PaginatedResult<WeeklyPlan>> {
    return this.weeklyPlanRepository.findByCampusId(
      input.campusId,
      input.params,
      {
        includeArchived: this.hasIsArchivedFilter(input.params),
      },
    );
  }

  private hasIsArchivedFilter(params: StandardRequest): boolean {
    const filters = params.filterInfo?.filters;
    if (
      filters &&
      Object.prototype.hasOwnProperty.call(filters, "isArchived")
    ) {
      return true;
    }

    if (typeof params.filter !== "string") {
      return false;
    }

    try {
      const parsedFilter = JSON.parse(params.filter) as Record<string, unknown>;
      return Object.prototype.hasOwnProperty.call(parsedFilter, "isArchived");
    } catch {
      return false;
    }
  }
}
