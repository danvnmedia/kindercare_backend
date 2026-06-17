import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class MealMenuConfigResponse {
  @Expose()
  @ApiProperty({
    description:
      "Operating days for future meal menus, where 1=Monday and 7=Sunday",
    example: [1, 2, 3, 4, 5],
    type: [Number],
  })
  operatingDays: number[];

  @Expose()
  @ApiProperty({
    description: "Default ordered meal slot labels for future meal menus",
    example: ["Breakfast", "Lunch", "Afternoon"],
    type: [String],
  })
  defaultMealSlots: string[];
}
