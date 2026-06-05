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
import {
  MealMenu,
  MealMenuEntryInput,
  MealMenuTargetType,
  UpdateMealMenuData,
} from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  buildMealMenuAuditContext,
  buildMealMenuAuditSnapshot,
  getMealMenuAuditActorId,
} from "../meal-menu-audit";
import {
  resolveMealMenuWriteTarget,
  ResolvedMealMenuWriteTarget,
} from "./meal-menu-target.resolver";

export interface UpdateMealMenuInput {
  campusId: string;
  weekStartDate?: Date;
  targetType: MealMenuTargetType;
  gradeLevelId?: string | null;
  classId?: string | null;
  title?: string | null;
  days?: number[];
  mealSlots?: string[];
  entries?: MealMenuEntryInput[];
}

const DUPLICATE_MEAL_MENU_MESSAGE =
  "An active meal menu already exists for this campus, target, and week";

@Injectable()
export class UpdateMealMenuUseCase {
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
    id: string,
    input: UpdateMealMenuInput,
    currentUser?: User,
  ): Promise<MealMenu> {
    const menu = await this.mealMenuRepository.findByIdInCampus(
      input.campusId,
      id,
    );
    if (!menu) {
      throw new NotFoundException(`Meal menu with ID ${id} not found`);
    }

    try {
      menu.ensureActive();
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid meal menu",
      );
    }

    const beforeValue = buildMealMenuAuditSnapshot(menu);

    const target = await resolveMealMenuWriteTarget({
      campusId: input.campusId,
      targetType: input.targetType,
      gradeLevelId: input.gradeLevelId,
      classId: input.classId,
      gradeLevelRepository: this.gradeLevelRepository,
      classRepository: this.classRepository,
    });

    try {
      menu.update(this.toUpdateData(input, target));
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid meal menu",
      );
    }

    const conflicting = await this.mealMenuRepository.findActiveByNaturalKey(
      {
        campusId: menu.campusId,
        ...menu.targetIdentity,
        weekStartDate: menu.weekStartDate,
      },
      menu.id,
    );
    if (conflicting) {
      throw new ConflictException(DUPLICATE_MEAL_MENU_MESSAGE);
    }

    try {
      return await this.unitOfWork.run(async (tx) => {
        const saved = await tx.updateMealMenu(menu);
        await tx.recordAudit({
          actorId: getMealMenuAuditActorId(currentUser),
          action: "UPDATE_MEAL_MENU",
          targetType: "meal_menu",
          targetId: saved.id,
          campusId: saved.campusId,
          context: buildMealMenuAuditContext(saved, currentUser),
          beforeValue,
          afterValue: buildMealMenuAuditSnapshot(saved),
        });
        return saved;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(DUPLICATE_MEAL_MENU_MESSAGE);
      }
      throw error;
    }
  }

  private toUpdateData(
    input: UpdateMealMenuInput,
    target: ResolvedMealMenuWriteTarget,
  ): UpdateMealMenuData {
    return {
      targetType: target.targetType,
      gradeLevelId: target.gradeLevelId,
      classId: target.classId,
      gradeLevel: target.gradeLevel,
      classroom: target.classroom,
      ...(input.weekStartDate !== undefined
        ? { weekStartDate: input.weekStartDate }
        : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.days !== undefined ? { days: input.days } : {}),
      ...(input.mealSlots !== undefined ? { mealSlots: input.mealSlots } : {}),
      ...(input.entries !== undefined ? { entries: input.entries } : {}),
    };
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
