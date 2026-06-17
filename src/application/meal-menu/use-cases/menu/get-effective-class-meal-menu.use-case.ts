import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { MealMenuRepository } from "@/application/meal-menu/ports";
import {
  MealMenu,
  MealMenuTargetType,
  normalizeWeekStartDate,
} from "@/domain/meal-menu";

export interface GetEffectiveClassMealMenuInput {
  campusId: string;
  classId: string;
  weekStartDate: Date;
}

export interface EffectiveClassMealMenuResult {
  resolvedTargetType: MealMenuTargetType | null;
  menu: MealMenu | null;
}

@Injectable()
export class GetEffectiveClassMealMenuUseCase {
  constructor(
    @Inject("MEAL_MENU_REPOSITORY")
    private readonly mealMenuRepository: MealMenuRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(
    input: GetEffectiveClassMealMenuInput,
  ): Promise<EffectiveClassMealMenuResult> {
    const classroom = await this.classRepository.findById(input.classId);

    if (!classroom || classroom.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    const weekStartDate = this.normalizeWeekStartDate(input.weekStartDate);

    const classMenu = await this.mealMenuRepository.findActiveByNaturalKey({
      campusId: input.campusId,
      targetType: "class",
      gradeLevelId: null,
      classId: input.classId,
      weekStartDate,
    });
    if (classMenu) {
      return { resolvedTargetType: "class", menu: classMenu };
    }

    const gradeMenu = await this.mealMenuRepository.findActiveByNaturalKey({
      campusId: input.campusId,
      targetType: "grade",
      gradeLevelId: classroom.gradeLevelId,
      classId: null,
      weekStartDate,
    });
    if (gradeMenu) {
      return { resolvedTargetType: "grade", menu: gradeMenu };
    }

    const campusMenu = await this.mealMenuRepository.findActiveByNaturalKey({
      campusId: input.campusId,
      targetType: "campus",
      gradeLevelId: null,
      classId: null,
      weekStartDate,
    });
    if (campusMenu) {
      return { resolvedTargetType: "campus", menu: campusMenu };
    }

    return { resolvedTargetType: null, menu: null };
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
