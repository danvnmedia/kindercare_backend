import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class CopyWeeklyPlanRequest {
  @ApiProperty({
    description:
      "One or more destination class UUIDs. Each valid class receives an independent copied weekly plan.",
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
      "Destination Monday calendar anchor for the copied weekly plan. Date-only strings or ISO datetimes are accepted and normalized by the backend.",
    example: "2026-06-08",
  })
  @IsDateString()
  weekStartDate: string;

  @ApiProperty({
    description:
      "Optional destination theme. Omit to preserve the source theme, or send null/blank to clear it.",
    example: "Spring Review",
    required: false,
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  theme?: string | null;
}
