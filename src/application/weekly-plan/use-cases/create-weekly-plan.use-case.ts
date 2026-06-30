import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { WeeklyPlanRepository } from "@/application/weekly-plan/ports";
import {
  normalizeOptionalTheme,
  normalizeWeekStartDate,
  normalizeWeeklyPlanBlocks,
  WeeklyPlan,
  WeeklyPlanBlockInput,
} from "@/domain/weekly-plan";
import { User } from "@/domain/user-management/user.entity";
import {
  buildWeeklyPlanAuditContext,
  buildWeeklyPlanAuditSnapshot,
  getWeeklyPlanAuditActorId,
} from "./weekly-plan-audit";
import { toWeeklyPlanClassSnapshot } from "./weekly-plan-class-context";
import {
  WeeklyPlanSkippedClass,
  WeeklyPlanSkippedReason,
} from "./weekly-plan-skip-reason";

export interface CreateWeeklyPlanInput {
  campusId: string;
  classIds: string[];
  weekStartDate: Date;
  theme?: string | null;
  blocks?: WeeklyPlanBlockInput[];
}

export interface CreateWeeklyPlanResult {
  created: WeeklyPlan[];
  skipped: WeeklyPlanSkippedClass[];
}

const DUPLICATE_WEEKLY_PLAN_MESSAGE =
  "An active weekly plan already exists for this campus, class, and week";

@Injectable()
export class CreateWeeklyPlanUseCase {
  constructor(
    @Inject("WEEKLY_PLAN_REPOSITORY")
    private readonly weeklyPlanRepository: WeeklyPlanRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: CreateWeeklyPlanInput,
    currentUser?: User,
  ): Promise<CreateWeeklyPlanResult> {
    const classIds = this.normalizeClassIds(input.classIds);
    const normalizedInput = this.normalizePlanInput(input);
    const planDrafts: WeeklyPlan[] = [];
    const skipped: WeeklyPlanSkippedClass[] = [];

    for (const classId of classIds) {
      const classroom = await this.classRepository.findById(classId);
      if (!classroom || classroom.campusId !== input.campusId) {
        skipped.push(
          this.toSkipped(classId, "CLASS_NOT_FOUND", "Class not found"),
        );
        continue;
      }

      let draft: WeeklyPlan;
      try {
        draft = WeeklyPlan.create({
          campusId: input.campusId,
          classId,
          classroom: toWeeklyPlanClassSnapshot(classroom),
          weekStartDate: normalizedInput.weekStartDate,
          theme: normalizedInput.theme,
          blocks: normalizedInput.blocks,
        });
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Invalid weekly plan",
        );
      }

      const existing = await this.weeklyPlanRepository.findActiveByNaturalKey({
        campusId: draft.campusId,
        classId: draft.classId,
        weekStartDate: draft.weekStartDate,
      });
      if (existing) {
        skipped.push(
          this.toSkipped(
            classId,
            "ACTIVE_WEEKLY_PLAN_EXISTS",
            DUPLICATE_WEEKLY_PLAN_MESSAGE,
          ),
        );
        continue;
      }

      planDrafts.push(draft);
    }

    if (planDrafts.length === 0) {
      return { created: [], skipped };
    }

    try {
      const created = await this.unitOfWork.run(async (tx) => {
        const results: WeeklyPlan[] = [];
        for (const plan of planDrafts) {
          const saved = await tx.createWeeklyPlan(plan);
          await tx.recordAudit({
            actorId: getWeeklyPlanAuditActorId(currentUser),
            action: "CREATE_WEEKLY_PLAN",
            targetType: "weekly_plan",
            targetId: saved.id,
            campusId: saved.campusId,
            context: buildWeeklyPlanAuditContext(saved, currentUser),
            afterValue: buildWeeklyPlanAuditSnapshot(saved),
          });
          results.push(saved);
        }
        return results;
      });

      return { created, skipped };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        if (classIds.length === 1) {
          return {
            created: [],
            skipped: [
              this.toSkipped(
                classIds[0],
                "ACTIVE_WEEKLY_PLAN_EXISTS",
                DUPLICATE_WEEKLY_PLAN_MESSAGE,
              ),
            ],
          };
        }
        throw new ConflictException(DUPLICATE_WEEKLY_PLAN_MESSAGE);
      }
      throw error;
    }
  }

  private normalizeClassIds(classIds: string[]): string[] {
    if (!Array.isArray(classIds) || classIds.length === 0) {
      throw new BadRequestException("classIds must be a non-empty array");
    }

    const seen = new Set<string>();
    for (const classId of classIds) {
      if (seen.has(classId)) {
        throw new BadRequestException("classIds must not contain duplicates");
      }
      seen.add(classId);
    }

    return classIds;
  }

  private normalizePlanInput(input: CreateWeeklyPlanInput): {
    weekStartDate: Date;
    theme: string | null;
    blocks: WeeklyPlanBlockInput[];
  } {
    try {
      return {
        weekStartDate: normalizeWeekStartDate(input.weekStartDate),
        theme: normalizeOptionalTheme(input.theme),
        blocks: normalizeWeeklyPlanBlocks(input.blocks),
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid weekly plan",
      );
    }
  }

  private toSkipped(
    classId: string,
    reason: WeeklyPlanSkippedReason,
    message: string,
  ): WeeklyPlanSkippedClass {
    return { classId, reason, message };
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
