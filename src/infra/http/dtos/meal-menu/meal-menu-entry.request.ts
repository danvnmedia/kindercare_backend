import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsString, Max, Min } from "class-validator";

export class MealMenuEntryRequest {
  @ApiProperty({
    description: "Day of week for this menu entry, where 1=Monday and 7=Sunday",
    example: 1,
    minimum: 1,
    maximum: 7,
  })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({
    description: "Meal slot label matching one of the menu mealSlots values",
    example: "Breakfast",
  })
  @IsString()
  @IsNotEmpty()
  slot: string;

  @ApiProperty({
    description:
      "Entry description. Blank values are accepted but trimmed and omitted by the backend.",
    example: "Oatmeal with fruit",
  })
  @IsString()
  description: string;
}
