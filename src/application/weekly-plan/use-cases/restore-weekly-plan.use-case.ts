import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { WeeklyPlanRepository } from "@/application/weekly-plan/ports";
import { WeeklyPlan } from "@/domain/weekly-plan";
import { User } from "@/domain/user-management/user.entity";
import {
  buildWeeklyPlanAuditContext,
  buildWeeklyPlanAuditSnapshot,
  getWeeklyPlanAuditActorId,
} from "./weekly-plan-audit";

const RESTORE_CONFLICT_MESSAGE =
  "An active weekly plan already exists for this campus, class, and week";

@Injectable()
export class RestoreWeeklyPlanUseCase {
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

    if (!plan.isArchived) {
      throw new BadRequestException(`Weekly plan with ID ${id} is not archived`);
    }

    const conflicting = await this.weeklyPlanRepository.findActiveByNaturalKey(
      {
        campusId: plan.campusId,
        classId: plan.classId,
        weekStartDate: plan.weekStartDate,
      },
      plan.id,
    );
    if (conflicting) {
      throw new ConflictException(RESTORE_CONFLICT_MESSAGE);
    }

    const beforeValue = buildWeeklyPlanAuditSnapshot(plan);
    plan.restore();

    try {
      return await this.unitOfWork.run(async (tx) => {
        const saved = await tx.restoreWeeklyPlan(plan);
        await tx.recordAudit({
          actorId: getWeeklyPlanAuditActorId(currentUser),
          action: "RESTORE_WEEKLY_PLAN",
          targetType: "weekly_plan",
          targetId: saved.id,
          campusId: saved.campusId,
          context: buildWeeklyPlanAuditContext(saved, currentUser),
          beforeValue,
          afterValue: buildWeeklyPlanAuditSnapshot(saved),
        });
        return saved;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(RESTORE_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }
}
