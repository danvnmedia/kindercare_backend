import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { WeeklyPlanSkippedReason } from "@/application/weekly-plan";
import { WeeklyPlanResponse } from "./weekly-plan.response";

export class WeeklyPlanSkippedClassResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  classId: string;

  @Expose()
  @ApiProperty({
    enum: ["CLASS_NOT_FOUND", "ACTIVE_WEEKLY_PLAN_EXISTS"],
    example: "ACTIVE_WEEKLY_PLAN_EXISTS",
  })
  reason: WeeklyPlanSkippedReason;

  @Expose()
  @ApiProperty({ example: "An active weekly plan already exists" })
  message: string;
}

export class CreateWeeklyPlanResponse {
  @Expose()
  @Type(() => WeeklyPlanResponse)
  @ApiProperty({ type: [WeeklyPlanResponse] })
  created: WeeklyPlanResponse[];

  @Expose()
  @Type(() => WeeklyPlanSkippedClassResponse)
  @ApiProperty({ type: [WeeklyPlanSkippedClassResponse] })
  skipped: WeeklyPlanSkippedClassResponse[];
}
