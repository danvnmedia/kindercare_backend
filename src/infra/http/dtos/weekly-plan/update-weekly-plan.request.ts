import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { WeeklyPlanBlockRequest } from "./weekly-plan-block.request";

export class UpdateWeeklyPlanRequest {
  @ApiProperty({
    description: "Optional class UUID to move this plan to.",
    example: "123e4567-e89b-12d3-a456-426614174002",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiProperty({
    description:
      "Optional Monday calendar anchor for the weekly plan. Date-only strings or ISO datetimes are accepted and normalized by the backend.",
    example: "2026-06-01",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  weekStartDate?: string;

  @ApiProperty({
    description: "Optional week-level theme. Null or blank clears the theme.",
    example: "Community Helpers",
    required: false,
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  theme?: string | null;

  @ApiProperty({
    description:
      "Optional full replacement flat weekly schedule blocks. Empty array clears the schedule.",
    type: [WeeklyPlanBlockRequest],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyPlanBlockRequest)
  blocks?: WeeklyPlanBlockRequest[];
}
