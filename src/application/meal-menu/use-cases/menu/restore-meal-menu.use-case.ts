import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { MealMenuRepository } from "@/application/meal-menu/ports";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { MealMenu } from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  buildMealMenuAuditContext,
  buildMealMenuAuditSnapshot,
  getMealMenuAuditActorId,
} from "../meal-menu-audit";

const RESTORE_CONFLICT_MESSAGE =
  "An active meal menu already exists for this campus, target, and week";

@Injectable()
export class RestoreMealMenuUseCase {
  constructor(
    @Inject("MEAL_MENU_REPOSITORY")
    private readonly mealMenuRepository: MealMenuRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    campusId: string,
    id: string,
    currentUser?: User,
  ): Promise<MealMenu> {
    const menu = await this.mealMenuRepository.findByIdInCampus(campusId, id);

    if (!menu) {
      throw new NotFoundException(`Meal menu with ID ${id} not found`);
    }

    if (!menu.isArchived) {
      throw new BadRequestException(`Meal menu with ID ${id} is not archived`);
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
      throw new ConflictException(RESTORE_CONFLICT_MESSAGE);
    }

    const beforeValue = buildMealMenuAuditSnapshot(menu);
    menu.restore();

    try {
      return await this.unitOfWork.run(async (tx) => {
        const saved = await tx.restoreMealMenu(menu);
        await tx.recordAudit({
          actorId: getMealMenuAuditActorId(currentUser),
          action: "RESTORE_MEAL_MENU",
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
