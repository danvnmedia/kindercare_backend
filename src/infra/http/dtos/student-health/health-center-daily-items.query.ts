import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";

import { transformStrictBooleanQuery } from "./strict-boolean-query.transform";

export class HealthCenterDailyItemsQuery {
  @ApiProperty({
    example: "2026-07-01",
    required: false,
    description: "Reference date for Health Center daily items.",
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174100",
    required: false,
    description: "Optional class UUID filter evaluated on the selected date.",
  })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiProperty({
    example: 0,
    required: false,
    description: "Number of instruction items to skip.",
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  instructionsOffset = 0;

  @ApiProperty({
    example: 50,
    required: false,
    description: "Number of instruction items to return.",
    default: 50,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  instructionsLimit = 50;

  @ApiProperty({
    example: 0,
    required: false,
    description: "Number of event items to skip.",
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  eventsOffset = 0;

  @ApiProperty({
    example: 50,
    required: false,
    description: "Number of event items to return.",
    default: 50,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  eventsLimit = 50;

  @ApiProperty({
    example: 0,
    required: false,
    description: "Number of medication administration items to skip.",
    default: 0,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  medicationsOffset = 0;

  @ApiProperty({
    example: 50,
    required: false,
    description: "Number of medication administration items to return.",
    default: 50,
    maximum: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  medicationsLimit = 50;

  @ApiProperty({
    example: false,
    required: false,
    description:
      "When true, returns access metadata and complete totals with empty item arrays.",
    default: false,
  })
  @Transform(({ value }) => transformStrictBooleanQuery(value))
  @IsOptional()
  @IsBoolean()
  summaryOnly = false;
}
