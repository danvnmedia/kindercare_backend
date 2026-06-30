import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { WeeklyPlanSkippedClassResponse } from "./create-weekly-plan.response";
import { WeeklyPlanResponse } from "./weekly-plan.response";

export class CopyWeeklyPlanResponse {
  @Expose()
  @Type(() => WeeklyPlanResponse)
  @ApiProperty({ type: [WeeklyPlanResponse] })
  copied: WeeklyPlanResponse[];

  @Expose()
  @Type(() => WeeklyPlanSkippedClassResponse)
  @ApiProperty({ type: [WeeklyPlanSkippedClassResponse] })
  skipped: WeeklyPlanSkippedClassResponse[];
}
