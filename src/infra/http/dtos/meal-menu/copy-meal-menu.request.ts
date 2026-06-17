import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import { MEAL_MENU_TARGET_TYPES, MealMenuTargetType } from "@/domain/meal-menu";

export class CopyMealMenuRequest {
  @ApiProperty({
    description:
      "Destination Monday calendar anchor for the copied weekly menu. Date-only strings or ISO datetimes are accepted and normalized by the backend.",
    example: "2026-06-08",
  })
  @IsDateString()
  weekStartDate: string;

  @ApiProperty({
    description: "Explicit destination menu target type.",
    enum: MEAL_MENU_TARGET_TYPES,
    example: "campus",
  })
  @IsIn([...MEAL_MENU_TARGET_TYPES])
  targetType: MealMenuTargetType;

  @ApiProperty({
    description:
      "Destination grade level target. Required only when targetType=grade. Do not send for campus or class targets.",
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsUUID()
  gradeLevelId?: string | null;

  @ApiProperty({
    description:
      "Destination class target. Required only when targetType=class. Do not send for campus or grade targets.",
    example: "123e4567-e89b-12d3-a456-426614174002",
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsUUID()
  classId?: string | null;

  @ApiProperty({
    description:
      "Optional destination title. Omit to preserve the source title, or send null/blank to clear it.",
    example: "Copied Week 2 Menu",
    required: false,
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;
}
