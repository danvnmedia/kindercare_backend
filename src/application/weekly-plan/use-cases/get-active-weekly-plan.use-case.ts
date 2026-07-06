import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { WeeklyPlanRepository } from "@/application/weekly-plan/ports";
import { normalizeWeekStartDate, WeeklyPlan } from "@/domain/weekly-plan";

export interface GetActiveWeeklyPlanInput {
  campusId: string;
  classId: string;
  weekStartDate: Date;
}

export interface ActiveWeeklyPlanResult {
  plan: WeeklyPlan | null;
}

@Injectable()
export class GetActiveWeeklyPlanUseCase {
  constructor(
    @Inject("WEEKLY_PLAN_REPOSITORY")
    private readonly weeklyPlanRepository: WeeklyPlanRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(
    input: GetActiveWeeklyPlanInput,
  ): Promise<ActiveWeeklyPlanResult> {
    const classroom = await this.classRepository.findById(input.classId);

    if (!classroom || classroom.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    const weekStartDate = this.normalizeWeekStartDate(input.weekStartDate);
    const plan = await this.weeklyPlanRepository.findActiveByNaturalKey({
      campusId: input.campusId,
      classId: input.classId,
      weekStartDate,
    });

    return { plan };
  }

  private normalizeWeekStartDate(weekStartDate: Date): Date {
    try {
      return normalizeWeekStartDate(weekStartDate);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid weekStartDate",
      );
    }
  }
}
