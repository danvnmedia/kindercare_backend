import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { WeeklyPlanRepository } from "@/application/weekly-plan/ports";
import { WeeklyPlan, WeeklyPlanBlockInput } from "@/domain/weekly-plan";
import { User } from "@/domain/user-management/user.entity";
import {
  buildWeeklyPlanAuditContext,
  buildWeeklyPlanAuditSnapshot,
  getWeeklyPlanAuditActorId,
} from "./weekly-plan-audit";
import { toWeeklyPlanClassSnapshot } from "./weekly-plan-class-context";

export interface UpdateWeeklyPlanInput {
  campusId: string;
  classId?: string;
  weekStartDate?: Date;
  theme?: string | null;
  blocks?: WeeklyPlanBlockInput[];
}

const DUPLICATE_WEEKLY_PLAN_MESSAGE =
  "An active weekly plan already exists for this campus, class, and week";

@Injectable()
export class UpdateWeeklyPlanUseCase {
  constructor(
    @Inject("WEEKLY_PLAN_REPOSITORY")
    private readonly weeklyPlanRepository: WeeklyPlanRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    input: UpdateWeeklyPlanInput,
    currentUser?: User,
  ): Promise<WeeklyPlan> {
    const plan = await this.weeklyPlanRepository.findByIdInCampus(
      input.campusId,
      id,
    );

    if (!plan) {
      throw new NotFoundException(`Weekly plan with ID ${id} not found`);
    }

    try {
      plan.ensureActive();
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid weekly plan",
      );
    }

    const classroom = await this.resolveClass(input.campusId, input.classId);
    const beforeValue = buildWeeklyPlanAuditSnapshot(plan);

    try {
      plan.update({
        ...(input.classId !== undefined ? { classId: input.classId } : {}),
        ...(classroom !== undefined
          ? { classroom: toWeeklyPlanClassSnapshot(classroom) }
          : {}),
        ...(input.weekStartDate !== undefined
          ? { weekStartDate: input.weekStartDate }
          : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.blocks !== undefined ? { blocks: input.blocks } : {}),
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid weekly plan",
      );
    }

    const existing = await this.weeklyPlanRepository.findActiveByNaturalKey(
      {
        campusId: plan.campusId,
        classId: plan.classId,
        weekStartDate: plan.weekStartDate,
      },
      plan.id,
    );
    if (existing) {
      throw new ConflictException(DUPLICATE_WEEKLY_PLAN_MESSAGE);
    }

    try {
      return await this.unitOfWork.run(async (tx) => {
        const saved = await tx.updateWeeklyPlan(plan);
        await tx.recordAudit({
          actorId: getWeeklyPlanAuditActorId(currentUser),
          action: "UPDATE_WEEKLY_PLAN",
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
        throw new ConflictException(DUPLICATE_WEEKLY_PLAN_MESSAGE);
      }
      throw error;
    }
  }

  private async resolveClass(campusId: string, classId: string | undefined) {
    if (classId === undefined) return undefined;

    const classroom = await this.classRepository.findById(classId);
    if (!classroom || classroom.campusId !== campusId) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
    }

    return classroom;
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
