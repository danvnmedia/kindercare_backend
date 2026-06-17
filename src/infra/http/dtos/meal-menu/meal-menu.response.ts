import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { MEAL_MENU_TARGET_TYPES, MealMenuTargetType } from "@/domain/meal-menu";

export class MealMenuEntryResponse {
  @Expose()
  @ApiProperty({ example: 1, description: "Day of week, where 1=Monday" })
  dayOfWeek: number;

  @Expose()
  @ApiProperty({ example: "Breakfast" })
  slot: string;

  @Expose()
  @ApiProperty({ example: "Oatmeal with fruit" })
  description: string;
}

export class MealMenuGradeLevelSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Kindergarten" })
  name: string;
}

export class MealMenuClassSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

  @Expose()
  @ApiProperty({ example: "K1 Room A" })
  name: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  gradeLevelId: string;
}

export class MealMenuResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "11111111-1111-4111-a111-111111111111" })
  campusId: string;

  @Expose()
  @ApiProperty({
    enum: MEAL_MENU_TARGET_TYPES,
    example: "class",
  })
  targetType: MealMenuTargetType;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
  })
  gradeLevelId: string | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174002",
    nullable: true,
  })
  classId: string | null;

  @Expose()
  @Type(() => MealMenuGradeLevelSummaryResponse)
  @ApiProperty({
    type: MealMenuGradeLevelSummaryResponse,
    nullable: true,
    required: false,
  })
  gradeLevel: MealMenuGradeLevelSummaryResponse | null;

  @Expose()
  @Type(() => MealMenuClassSummaryResponse)
  @ApiProperty({
    type: MealMenuClassSummaryResponse,
    nullable: true,
    required: false,
  })
  classroom: MealMenuClassSummaryResponse | null;

  @Expose()
  @ApiProperty({
    example: "2026-06-01T00:00:00.000Z",
    description: "Monday date anchor with date-only semantics",
  })
  weekStartDate: Date;

  @Expose()
  @ApiProperty({ example: "Week 1 Menu", nullable: true })
  title: string | null;

  @Expose()
  @ApiProperty({ example: [1, 2, 3, 4, 5], type: [Number] })
  days: number[];

  @Expose()
  @ApiProperty({
    example: ["Breakfast", "Lunch", "Afternoon"],
    type: [String],
  })
  mealSlots: string[];

  @Expose()
  @Type(() => MealMenuEntryResponse)
  @ApiProperty({ type: [MealMenuEntryResponse] })
  entries: MealMenuEntryResponse[];

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  @Expose()
  @ApiProperty({ example: "2026-05-30T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-05-30T00:00:00.000Z" })
  updatedAt: Date;
}
