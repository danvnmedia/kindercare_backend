import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { MEAL_MENU_TARGET_TYPES, MealMenuTargetType } from "@/domain/meal-menu";

import { MealMenuResponse } from "./meal-menu.response";

export class EffectiveClassMealMenuResponse {
  @Expose()
  @ApiProperty({
    enum: MEAL_MENU_TARGET_TYPES,
    nullable: true,
    example: "class",
    description:
      "Target type that supplied the effective menu. Null when no applicable menu exists.",
  })
  resolvedTargetType: MealMenuTargetType | null;

  @Expose()
  @Type(() => MealMenuResponse)
  @ApiProperty({
    type: MealMenuResponse,
    nullable: true,
    description:
      "Resolved meal menu. Null when the class is valid but no class, grade, or campus menu applies.",
  })
  menu: MealMenuResponse | null;
}
