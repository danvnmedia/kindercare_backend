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
import {
  normalizeOptionalTheme,
  normalizeWeekStartDate,
  WeeklyPlan,
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

export interface CopyWeeklyPlanInput {
  campusId: string;
  classIds: string[];
  weekStartDate: Date;
  theme?: string | null;
}

export interface CopyWeeklyPlanResult {
  copied: WeeklyPlan[];
  skipped: WeeklyPlanSkippedClass[];
}

const DUPLICATE_WEEKLY_PLAN_MESSAGE =
  "An active weekly plan already exists for this campus, class, and week";

@Injectable()
export class CopyWeeklyPlanUseCase {
  constructor(
    @Inject("WEEKLY_PLAN_REPOSITORY")
    private readonly weeklyPlanRepository: WeeklyPlanRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    sourceId: string,
    input: CopyWeeklyPlanInput,
    currentUser?: User,
  ): Promise<CopyWeeklyPlanResult> {
    const source = await this.weeklyPlanRepository.findByIdInCampus(
      input.campusId,
      sourceId,
    );

    if (!source) {
      throw new NotFoundException(`Weekly plan with ID ${sourceId} not found`);
    }
    if (source.isArchived) {
      throw new BadRequestException("Archived weekly plans cannot be copied");
    }

    const classIds = this.normalizeClassIds(input.classIds);
    const weekStartDate = this.normalizeDestinationWeek(input.weekStartDate);
    const theme = this.normalizeDestinationTheme(input.theme, source.theme);

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
          weekStartDate,
          theme,
          blocks: source.blocks,
        });
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : "Invalid weekly plan copy",
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
      return { copied: [], skipped };
    }

    try {
      const copied = await this.unitOfWork.run(async (tx) => {
        const results: WeeklyPlan[] = [];
        for (const plan of planDrafts) {
          const saved = await tx.createWeeklyPlan(plan);
          await tx.recordAudit({
            actorId: getWeeklyPlanAuditActorId(currentUser),
            action: "COPY_WEEKLY_PLAN",
            targetType: "weekly_plan",
            targetId: saved.id,
            campusId: saved.campusId,
            context: buildWeeklyPlanAuditContext(saved, currentUser, {
              sourceWeeklyPlanId: source.id,
              sourceWeekStartDate: source.weekStartDate.toISOString(),
              sourceClassId: source.classId,
            }),
            afterValue: buildWeeklyPlanAuditSnapshot(saved),
          });
          results.push(saved);
        }
        return results;
      });

      return { copied, skipped };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        if (classIds.length === 1) {
          return {
            copied: [],
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

  private normalizeDestinationWeek(weekStartDate: Date): Date {
    try {
      return normalizeWeekStartDate(weekStartDate);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid weekly plan copy",
      );
    }
  }

  private normalizeDestinationTheme(
    theme: string | null | undefined,
    sourceTheme: string | null,
  ): string | null {
    if (theme === undefined) return sourceTheme;

    try {
      return normalizeOptionalTheme(theme);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid weekly plan copy",
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
