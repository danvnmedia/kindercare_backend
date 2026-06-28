import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, Type } from "class-transformer";

import { formatMinuteAsTime } from "@/domain/weekly-plan";

export class WeeklyPlanClassSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

  @Expose()
  @ApiProperty({ example: "K1 Room A" })
  name: string;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
  })
  gradeLevelId: string | null;

  @Expose()
  @ApiProperty({ example: "Kindergarten", nullable: true })
  gradeLevelName: string | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174003",
    nullable: true,
  })
  schoolYearId: string | null;

  @Expose()
  @ApiProperty({ example: "2026-2027", nullable: true })
  schoolYearName: string | null;
}

export class WeeklyPlanActivityResponse {
  @Expose()
  @ApiProperty({ example: 0 })
  order: number;

  @Expose()
  @ApiProperty({ example: "Morning Meeting" })
  title: string;

  @Expose()
  @ApiProperty({ example: "Greeting and calendar", nullable: true })
  description: string | null;
}

export class WeeklyPlanBlockResponse {
  @Expose()
  @ApiProperty({ example: 1, description: "Day of week, where 1=Monday" })
  dayOfWeek: number;

  @Expose()
  @ApiProperty({ example: "09:00" })
  @Transform(({ obj }) => formatMinuteAsTime(obj.startMinute, "startMinute"))
  startTime: string;

  @Expose()
  @ApiProperty({ example: "10:00" })
  @Transform(({ obj }) => formatMinuteAsTime(obj.endMinute, "endMinute"))
  endTime: string;

  @Expose()
  @Type(() => WeeklyPlanActivityResponse)
  @ApiProperty({ type: [WeeklyPlanActivityResponse] })
  activities: WeeklyPlanActivityResponse[];
}

export class WeeklyPlanResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "11111111-1111-4111-a111-111111111111" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  classId: string;

  @Expose()
  @Type(() => WeeklyPlanClassSummaryResponse)
  @ApiProperty({ type: WeeklyPlanClassSummaryResponse, nullable: true })
  classroom: WeeklyPlanClassSummaryResponse | null;

  @Expose()
  @ApiProperty({
    example: "2026-06-01T00:00:00.000Z",
    description: "Monday date anchor with date-only semantics",
  })
  weekStartDate: Date;

  @Expose()
  @ApiProperty({ example: "Community Helpers", nullable: true })
  theme: string | null;

  @Expose()
  @Type(() => WeeklyPlanBlockResponse)
  @ApiProperty({ type: [WeeklyPlanBlockResponse] })
  blocks: WeeklyPlanBlockResponse[];

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  @Expose()
  @ApiProperty({ example: "2026-06-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-06-01T00:00:00.000Z" })
  updatedAt: Date;
}
