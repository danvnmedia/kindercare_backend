import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { MealMenuRepository } from "@/application/meal-menu/ports";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  MealMenu,
  MealMenuEntryInput,
  MealMenuGradeLevelSnapshot,
  UpdateMealMenuData,
} from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  buildMealMenuAuditContext,
  buildMealMenuAuditSnapshot,
  getMealMenuAuditActorId,
} from "../meal-menu-audit";

export interface UpdateMealMenuInput {
  campusId: string;
  weekStartDate?: Date;
  gradeLevelId?: string | null;
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

    let gradeLevel: MealMenuGradeLevelSnapshot | null | undefined;
    if (input.gradeLevelId !== undefined) {
      gradeLevel = await this.resolveGradeLevelSnapshot(
        input.campusId,
        input.gradeLevelId,
      );
    }

    try {
      menu.update(this.toUpdateData(input, gradeLevel));
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid meal menu",
      );
    }

    const conflicting = await this.mealMenuRepository.findActiveByNaturalKey(
      {
        campusId: menu.campusId,
        gradeLevelId: menu.gradeLevelId,
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
    gradeLevel: MealMenuGradeLevelSnapshot | null | undefined,
  ): UpdateMealMenuData {
    return {
      ...(input.weekStartDate !== undefined
        ? { weekStartDate: input.weekStartDate }
        : {}),
      ...(input.gradeLevelId !== undefined
        ? { gradeLevelId: input.gradeLevelId, gradeLevel }
        : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.days !== undefined ? { days: input.days } : {}),
      ...(input.mealSlots !== undefined ? { mealSlots: input.mealSlots } : {}),
      ...(input.entries !== undefined ? { entries: input.entries } : {}),
    };
  }

  private async resolveGradeLevelSnapshot(
    campusId: string,
    gradeLevelId: string | null,
  ): Promise<MealMenuGradeLevelSnapshot | null> {
    if (gradeLevelId === null) {
      return null;
    }

    const gradeLevel = await this.gradeLevelRepository.findById(gradeLevelId);
    if (!gradeLevel || gradeLevel.campusId !== campusId) {
      throw new NotFoundException(
        `Grade level with ID ${gradeLevelId} not found`,
      );
    }

    return {
      id: gradeLevel.id,
      name: gradeLevel.name,
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
