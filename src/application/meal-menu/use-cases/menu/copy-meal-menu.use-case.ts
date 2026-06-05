import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { MealMenuRepository } from "@/application/meal-menu/ports";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { MealMenu, MealMenuTargetType } from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  buildMealMenuAuditContext,
  buildMealMenuAuditSnapshot,
  getMealMenuAuditActorId,
} from "../meal-menu-audit";
import { resolveMealMenuWriteTarget } from "./meal-menu-target.resolver";

export interface CopyMealMenuInput {
  campusId: string;
  weekStartDate: Date;
  targetType: MealMenuTargetType;
  gradeLevelId?: string | null;
  classId?: string | null;
  title?: string | null;
}

const COPY_CONFLICT_MESSAGE =
  "An active meal menu already exists for this campus, target, and week";

@Injectable()
export class CopyMealMenuUseCase {
  constructor(
    @Inject("MEAL_MENU_REPOSITORY")
    private readonly mealMenuRepository: MealMenuRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    sourceId: string,
    input: CopyMealMenuInput,
    currentUser?: User,
  ): Promise<MealMenu> {
    const source = await this.mealMenuRepository.findByIdInCampus(
      input.campusId,
      sourceId,
    );

    if (!source) {
      throw new NotFoundException(`Meal menu with ID ${sourceId} not found`);
    }

    if (source.isArchived) {
      throw new BadRequestException("Archived meal menus cannot be copied");
    }

    const target = await resolveMealMenuWriteTarget({
      campusId: input.campusId,
      targetType: input.targetType,
      gradeLevelId: input.gradeLevelId,
      classId: input.classId,
      gradeLevelRepository: this.gradeLevelRepository,
      classRepository: this.classRepository,
    });

    let copy: MealMenu;
    try {
      copy = MealMenu.create({
        campusId: input.campusId,
        targetType: target.targetType,
        gradeLevelId: target.gradeLevelId,
        classId: target.classId,
        gradeLevel: target.gradeLevel,
        classroom: target.classroom,
        weekStartDate: input.weekStartDate,
        title: input.title === undefined ? source.title : input.title,
        days: source.days,
        mealSlots: source.mealSlots,
        entries: source.entries,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid meal menu copy",
      );
    }

    const existing = await this.mealMenuRepository.findActiveByNaturalKey({
      campusId: copy.campusId,
      ...copy.targetIdentity,
      weekStartDate: copy.weekStartDate,
    });
    if (existing) {
      throw new ConflictException(COPY_CONFLICT_MESSAGE);
    }

    try {
      return await this.unitOfWork.run(async (tx) => {
        const saved = await tx.createMealMenu(copy);
        await tx.recordAudit({
          actorId: getMealMenuAuditActorId(currentUser),
          action: "COPY_MEAL_MENU",
          targetType: "meal_menu",
          targetId: saved.id,
          campusId: saved.campusId,
          context: buildMealMenuAuditContext(saved, currentUser, {
            sourceMealMenuId: source.id,
            sourceWeekStartDate: source.weekStartDate.toISOString(),
            sourceTargetType: source.targetType,
            sourceGradeLevelId: source.gradeLevelId,
            sourceClassId: source.classId,
          }),
          afterValue: buildMealMenuAuditSnapshot(saved),
        });
        return saved;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(COPY_CONFLICT_MESSAGE);
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
