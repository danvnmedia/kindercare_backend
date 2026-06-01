import { Inject, Injectable } from "@nestjs/common";

import { MealMenuConfigRepository } from "../../ports";
import { MealMenuConfig } from "@/domain/meal-menu";

@Injectable()
export class GetMealMenuConfigUseCase {
  constructor(
    @Inject("MEAL_MENU_CONFIG_REPOSITORY")
    private readonly mealMenuConfigRepository: MealMenuConfigRepository,
  ) {}

  async execute(campusId: string): Promise<MealMenuConfig> {
    const existingConfig =
      await this.mealMenuConfigRepository.findByCampusId(campusId);

    return existingConfig ?? MealMenuConfig.create({ campusId });
  }
}
