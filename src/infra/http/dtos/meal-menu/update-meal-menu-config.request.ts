import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UpdateMealMenuConfigRequest {
  @ApiProperty({
    description:
      "Operating days for future meal menus, where 1=Monday and 7=Sunday",
    example: [1, 2, 3, 4, 5],
    type: [Number],
    minItems: 1,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  operatingDays: number[];

  @ApiProperty({
    description: "Default ordered meal slot labels for future meal menus",
    example: ["Breakfast", "Lunch", "Afternoon"],
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  defaultMealSlots: string[];
}
