import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  StudentHealthEventStatus,
  StudentHealthEventType,
} from "@/domain/student-health";

import { transformStrictBooleanQuery } from "./strict-boolean-query.transform";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class ListStudentHealthEventsQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "Include archived events in ordinary history. Omit for active-only results; only literal true or false is accepted.",
  })
  @Type(() => String)
  @Transform(({ value }) => transformStrictBooleanQuery(value))
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;

  @ApiProperty({
    enum: StudentHealthEventStatus,
    required: false,
    description: "Manual health event status filter.",
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthEventStatus)
  status?: StudentHealthEventStatus;

  @ApiProperty({
    enum: StudentHealthEventType,
    required: false,
    description: "Manual health event type filter.",
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsEnum(StudentHealthEventType)
  eventType?: StudentHealthEventType;
}
