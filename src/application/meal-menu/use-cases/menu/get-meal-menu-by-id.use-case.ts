import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { MealMenuRepository } from "@/application/meal-menu/ports";
import { MealMenu } from "@/domain/meal-menu";

@Injectable()
export class GetMealMenuByIdUseCase {
  constructor(
    @Inject("MEAL_MENU_REPOSITORY")
    private readonly mealMenuRepository: MealMenuRepository,
  ) {}

  async execute(campusId: string, id: string): Promise<MealMenu> {
    const menu = await this.mealMenuRepository.findByIdInCampus(campusId, id);

    if (!menu) {
      throw new NotFoundException(`Meal menu with ID ${id} not found`);
    }

    return menu;
  }
}
