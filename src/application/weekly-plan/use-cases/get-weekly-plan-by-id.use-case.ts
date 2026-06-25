import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { WeeklyPlanRepository } from "@/application/weekly-plan/ports";
import { WeeklyPlan } from "@/domain/weekly-plan";

@Injectable()
export class GetWeeklyPlanByIdUseCase {
  constructor(
    @Inject("WEEKLY_PLAN_REPOSITORY")
    private readonly weeklyPlanRepository: WeeklyPlanRepository,
  ) {}

  async execute(campusId: string, id: string): Promise<WeeklyPlan> {
    const plan = await this.weeklyPlanRepository.findByIdInCampus(campusId, id);

    if (!plan) {
      throw new NotFoundException(`Weekly plan with ID ${id} not found`);
    }

    return plan;
  }
}
