import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { WeeklyPlanResponse } from "./weekly-plan.response";

export class ActiveWeeklyPlanResponse {
  @Expose()
  @Type(() => WeeklyPlanResponse)
  @ApiProperty({ type: WeeklyPlanResponse, nullable: true })
  plan: WeeklyPlanResponse | null;
}
