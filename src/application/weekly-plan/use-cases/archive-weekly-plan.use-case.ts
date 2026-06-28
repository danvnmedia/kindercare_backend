import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { WeeklyPlanRepository } from "@/application/weekly-plan/ports";
import { WeeklyPlan } from "@/domain/weekly-plan";
import { User } from "@/domain/user-management/user.entity";
import {
  buildWeeklyPlanAuditContext,
  buildWeeklyPlanAuditSnapshot,
  getWeeklyPlanAuditActorId,
} from "./weekly-plan-audit";

@Injectable()
export class ArchiveWeeklyPlanUseCase {
  constructor(
    @Inject("WEEKLY_PLAN_REPOSITORY")
    private readonly weeklyPlanRepository: WeeklyPlanRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    campusId: string,
    id: string,
    currentUser?: User,
  ): Promise<WeeklyPlan> {
    const plan = await this.weeklyPlanRepository.findByIdInCampus(campusId, id);

    if (!plan) {
      throw new NotFoundException(`Weekly plan with ID ${id} not found`);
    }

    const wasArchived = plan.isArchived;
    const beforeValue = buildWeeklyPlanAuditSnapshot(plan);
    plan.archive();

    if (wasArchived) {
      return plan;
    }

    return this.unitOfWork.run(async (tx) => {
      const saved = await tx.archiveWeeklyPlan(plan);
      await tx.recordAudit({
        actorId: getWeeklyPlanAuditActorId(currentUser),
        action: "ARCHIVE_WEEKLY_PLAN",
        targetType: "weekly_plan",
        targetId: saved.id,
        campusId: saved.campusId,
        context: buildWeeklyPlanAuditContext(saved, currentUser),
        beforeValue,
        afterValue: buildWeeklyPlanAuditSnapshot(saved),
      });
      return saved;
    });
  }
}
