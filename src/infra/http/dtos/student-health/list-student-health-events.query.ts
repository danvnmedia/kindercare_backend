import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  StudentHealthEventStatus,
  StudentHealthEventType,
} from "@/domain/student-health";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class ListStudentHealthEventsQuery extends StandardRequestDto {
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
