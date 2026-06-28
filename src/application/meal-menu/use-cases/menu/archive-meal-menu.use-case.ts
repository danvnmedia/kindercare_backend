import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { MealMenuRepository } from "@/application/meal-menu/ports";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { MealMenu } from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  buildMealMenuAuditContext,
  buildMealMenuAuditSnapshot,
  getMealMenuAuditActorId,
} from "../meal-menu-audit";

@Injectable()
export class ArchiveMealMenuUseCase {
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

    const wasArchived = menu.isArchived;
    const beforeValue = buildMealMenuAuditSnapshot(menu);
    menu.archive();

    if (wasArchived) {
      return menu;
    }

    return this.unitOfWork.run(async (tx) => {
      const saved = await tx.archiveMealMenu(menu);
      await tx.recordAudit({
        actorId: getMealMenuAuditActorId(currentUser),
        action: "ARCHIVE_MEAL_MENU",
        targetType: "meal_menu",
        targetId: saved.id,
        campusId: saved.campusId,
        context: buildMealMenuAuditContext(saved, currentUser),
        beforeValue,
        afterValue: buildMealMenuAuditSnapshot(saved),
      });
      return saved;
    });
  }
}
