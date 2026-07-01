import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsDateString, IsOptional, Matches } from "class-validator";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class ActiveHealthInstructionsQuery {
  @ApiProperty({
    example: "2026-07-01",
    required: false,
    description: "Reference date for active instruction calculation.",
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;
}
