import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import {
  MealMenuConfigRepository,
  MealMenuRepository,
} from "@/application/meal-menu/ports";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  MealMenu,
  MealMenuEntryInput,
  MealMenuGradeLevelSnapshot,
  MealMenuConfig,
} from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  buildMealMenuAuditContext,
  buildMealMenuAuditSnapshot,
  getMealMenuAuditActorId,
} from "../meal-menu-audit";

export interface CreateMealMenuInput {
  campusId: string;
  weekStartDate: Date;
  gradeLevelId?: string | null;
  title?: string | null;
  days?: number[];
  mealSlots?: string[];
  entries?: MealMenuEntryInput[];
}

const DUPLICATE_MEAL_MENU_MESSAGE =
  "An active meal menu already exists for this campus, target, and week";

@Injectable()
export class CreateMealMenuUseCase {
  constructor(
    @Inject("MEAL_MENU_REPOSITORY")
    private readonly mealMenuRepository: MealMenuRepository,
    @Inject("MEAL_MENU_CONFIG_REPOSITORY")
    private readonly mealMenuConfigRepository: MealMenuConfigRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: CreateMealMenuInput,
    currentUser?: User,
  ): Promise<MealMenu> {
    const gradeLevelId = input.gradeLevelId ?? null;
    const gradeLevel = await this.resolveGradeLevelSnapshot(
      input.campusId,
      gradeLevelId,
    );
    const config = await this.getConfigDefaults(input.campusId);

    let menu: MealMenu;
    try {
      menu = MealMenu.create({
        campusId: input.campusId,
        gradeLevelId,
        gradeLevel,
        weekStartDate: input.weekStartDate,
        title: input.title,
        days: input.days ?? config.operatingDays,
        mealSlots: input.mealSlots ?? config.defaultMealSlots,
        entries: input.entries ?? [],
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid meal menu",
      );
    }

    const existing = await this.mealMenuRepository.findActiveByNaturalKey({
      campusId: menu.campusId,
      gradeLevelId: menu.gradeLevelId,
      weekStartDate: menu.weekStartDate,
    });
    if (existing) {
      throw new ConflictException(DUPLICATE_MEAL_MENU_MESSAGE);
    }

    try {
      return await this.unitOfWork.run(async (tx) => {
        const saved = await tx.createMealMenu(menu);
        await tx.recordAudit({
          actorId: getMealMenuAuditActorId(currentUser),
          action: "CREATE_MEAL_MENU",
          targetType: "meal_menu",
          targetId: saved.id,
          campusId: saved.campusId,
          context: buildMealMenuAuditContext(saved, currentUser),
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

  private async getConfigDefaults(campusId: string): Promise<MealMenuConfig> {
    const config = await this.mealMenuConfigRepository.findByCampusId(campusId);
    return config ?? MealMenuConfig.create({ campusId });
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
