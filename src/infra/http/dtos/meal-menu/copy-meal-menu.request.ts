import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class CopyMealMenuRequest {
  @ApiProperty({
    description:
      "Destination Monday calendar anchor for the copied weekly menu. Date-only strings or ISO datetimes are accepted and normalized by the backend.",
    example: "2026-06-08",
  })
  @IsDateString()
  weekStartDate: string;

  @ApiProperty({
    description:
      "Destination grade level target. Use explicit null for a whole-campus copy destination.",
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
  })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  gradeLevelId: string | null;

  @ApiProperty({
    description:
      "Optional destination title. Omit to preserve the source title, or send null/blank to clear it.",
    example: "Copied Week 2 Menu",
    required: false,
    nullable: true,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string | null;
}
