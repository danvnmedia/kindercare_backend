import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";

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
}
