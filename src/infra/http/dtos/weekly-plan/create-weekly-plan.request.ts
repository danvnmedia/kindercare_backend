import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from "class-validator";

import { WeeklyPlanBlockRequest } from "./weekly-plan-block.request";

export class CreateWeeklyPlanRequest {
  @ApiProperty({
    description:
      "One or more class UUIDs. Each class receives an independent weekly plan.",
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  classIds: string[];

  @ApiProperty({
    description:
      "Monday calendar anchor for the weekly plan. Date-only strings or ISO datetimes are accepted and normalized by the backend.",
    example: "2026-06-01",
  })
  @IsDateString()
  weekStartDate: string;

  @ApiProperty({
    description: "Optional week-level theme.",
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
    description: "Flat weekly schedule blocks.",
    type: [WeeklyPlanBlockRequest],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklyPlanBlockRequest)
  blocks?: WeeklyPlanBlockRequest[];
}
