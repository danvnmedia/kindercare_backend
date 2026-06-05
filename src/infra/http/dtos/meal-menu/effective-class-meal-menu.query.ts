import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsUUID } from "class-validator";

export class EffectiveClassMealMenuQuery {
  @ApiProperty({
    description: "Class UUID to resolve the effective weekly menu for.",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsUUID()
  classId: string;

  @ApiProperty({
    description:
      "Monday calendar anchor for the weekly menu. Date-only strings or ISO datetimes are accepted and normalized by the backend.",
    example: "2026-06-01",
  })
  @IsDateString()
  weekStartDate: string;
}
