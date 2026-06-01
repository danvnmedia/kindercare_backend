import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

const MEAL_MENU_TARGETS = ["all", "campus", "grade"] as const;

export type ListMealMenusTarget = (typeof MEAL_MENU_TARGETS)[number];

export class ListMealMenusQuery extends StandardRequestDto {
  @ApiProperty({
    description:
      "Target scope. Omit or use all for both whole-campus and grade-level menus; campus returns whole-campus menus only; grade requires gradeLevelId.",
    enum: MEAL_MENU_TARGETS,
    required: false,
    example: "all",
  })
  @IsOptional()
  @IsIn(MEAL_MENU_TARGETS)
  target?: ListMealMenusTarget;

  @ApiProperty({
    description: "Grade level target used only when target=grade.",
    example: "123e4567-e89b-12d3-a456-426614174001",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  gradeLevelId?: string;
}
