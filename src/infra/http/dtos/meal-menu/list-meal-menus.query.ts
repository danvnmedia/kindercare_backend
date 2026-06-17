import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

const MEAL_MENU_TARGETS = ["all", "campus", "grade", "class"] as const;

export type ListMealMenusTarget = (typeof MEAL_MENU_TARGETS)[number];

export class ListMealMenusQuery extends StandardRequestDto {
  @ApiProperty({
    description:
      "Target scope. Omit or use all for all target types; campus returns whole-campus menus only; grade requires gradeLevelId; class requires classId.",
    enum: MEAL_MENU_TARGETS,
    required: false,
    example: "all",
  })
  @IsOptional()
  @IsIn(MEAL_MENU_TARGETS)
  target?: ListMealMenusTarget;

  @ApiProperty({
    description:
      "Grade level target used only when target=grade. Supplying it with target=campus, target=class, or target=all is rejected.",
    example: "123e4567-e89b-12d3-a456-426614174001",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  gradeLevelId?: string;

  @ApiProperty({
    description:
      "Class target used only when target=class. Supplying it with target=campus, target=grade, or target=all is rejected.",
    example: "123e4567-e89b-12d3-a456-426614174002",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  classId?: string;
}
