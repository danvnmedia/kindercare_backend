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

export class UpdateMealMenuRequest {
  @ApiProperty({
    description:
      "Monday calendar anchor for the weekly menu. Date-only strings or ISO datetimes are accepted and normalized by the backend.",
    example: "2026-06-01",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @ApiProperty({
    description: "Grade level target. Use null to retarget to whole-campus.",
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsUUID()
  gradeLevelId?: string | null;

  @ApiProperty({
    description: "Optional menu title. Use null or blank to clear the title.",
    example: "Updated Week 1 Menu",
    required: false,
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;

  @ApiProperty({
    description: "Replacement operating days snapshot for this menu.",
    example: [2, 3, 4, 5],
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
    description: "Replacement ordered meal slot labels snapshot for this menu.",
    example: ["Breakfast", "Lunch", "Snack"],
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
      "Replacement meal grid entries. When supplied, the backend replaces the stored grid entries in one save operation.",
    type: [MealMenuEntryRequest],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MealMenuEntryRequest)
  entries?: MealMenuEntryRequest[];
}
