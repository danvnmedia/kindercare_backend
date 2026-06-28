import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { MealMenuConfig } from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import { MealMenuConfigRepository } from "../../ports";
import {
  buildMealMenuConfigAuditContext,
  buildMealMenuConfigAuditSnapshot,
  getMealMenuAuditActorId,
} from "../meal-menu-audit";

export interface UpdateMealMenuConfigInput {
  operatingDays: number[];
  defaultMealSlots: string[];
}

@Injectable()
export class UpdateMealMenuConfigUseCase {
  constructor(
    @Inject("MEAL_MENU_CONFIG_REPOSITORY")
    private readonly mealMenuConfigRepository: MealMenuConfigRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    campusId: string,
    input: UpdateMealMenuConfigInput,
    currentUser?: User,
  ): Promise<MealMenuConfig> {
    if (
      !Array.isArray(input.operatingDays) ||
      !Array.isArray(input.defaultMealSlots)
    ) {
      throw new BadRequestException(
        "operatingDays and defaultMealSlots are required",
      );
    }

    let config = await this.mealMenuConfigRepository.findByCampusId(campusId);
    const beforeValue = config
      ? buildMealMenuConfigAuditSnapshot(config)
      : null;
    config ??= MealMenuConfig.create({ campusId });

    try {
      config.update({
        operatingDays: input.operatingDays,
        defaultMealSlots: input.defaultMealSlots,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid meal menu config",
      );
    }

    return this.unitOfWork.run(async (tx) => {
      const saved = await tx.upsertMealMenuConfig(config);
      await tx.recordAudit({
        actorId: getMealMenuAuditActorId(currentUser),
        action: "UPDATE_MEAL_MENU_CONFIG",
        targetType: "meal_menu_config",
        targetId: saved.id,
        campusId: saved.campusId,
        context: buildMealMenuConfigAuditContext(saved, currentUser),
        beforeValue,
        afterValue: buildMealMenuConfigAuditSnapshot(saved),
      });
      return saved;
    });
  }
}
