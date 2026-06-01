import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

import { MealMenuEntryRequest } from "./meal-menu-entry.request";

export class CreateMealMenuRequest {
  @ApiProperty({
    description:
      "Monday calendar anchor for the weekly menu. Date-only strings or ISO datetimes are accepted and normalized by the backend.",
    example: "2026-06-01",
  })
  @IsDateString()
  weekStartDate: string;

  @ApiProperty({
    description:
      "Grade level target. Use null or omit for a whole-campus menu.",
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsUUID()
  gradeLevelId?: string | null;

  @ApiProperty({
    description: "Optional menu title",
    example: "Week 1 Menu",
    required: false,
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @ApiProperty({
    description:
      "Operating days snapshot for this menu. If omitted, saved config or virtual defaults are used.",
    example: [1, 2, 3, 4, 5],
    type: [Number],
    minItems: 1,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  days?: number[];

  @ApiProperty({
    description:
      "Ordered meal slot labels snapshot for this menu. If omitted, saved config or virtual defaults are used.",
    example: ["Breakfast", "Lunch", "Afternoon"],
    type: [String],
    minItems: 1,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  mealSlots?: string[];

  @ApiProperty({
    description:
      "Meal grid entries. Entries with blank descriptions are omitted.",
    type: [MealMenuEntryRequest],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealMenuEntryRequest)
  entries?: MealMenuEntryRequest[];
}
