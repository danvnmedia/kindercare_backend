import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class WeeklyPlanActivityRequest {
  @ApiProperty({ example: "Morning Meeting", maxLength: 500 })
  @IsString()
  @MaxLength(500)
  title: string;

  @ApiProperty({
    example: "Greeting, calendar, and weather",
    maxLength: 2000,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class WeeklyPlanBlockRequest {
  @ApiProperty({ example: 1, description: "Day of week, where 1=Monday" })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ example: "09:00" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/)
  startTime: string;

  @ApiProperty({ example: "10:00" })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$|^24:00$/)
  endTime: string;

  @ApiProperty({ type: [WeeklyPlanActivityRequest] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => WeeklyPlanActivityRequest)
  activities: WeeklyPlanActivityRequest[];
}
