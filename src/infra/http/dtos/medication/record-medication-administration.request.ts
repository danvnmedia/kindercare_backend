import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

import { MedicationAdministrationOutcome } from "@/domain/medication";

export class RecordMedicationAdministrationRequest {
  @ApiProperty({
    enum: MedicationAdministrationOutcome,
    example: MedicationAdministrationOutcome.GIVEN,
  })
  @IsEnum(MedicationAdministrationOutcome)
  outcome: MedicationAdministrationOutcome;

  @ApiPropertyOptional({ example: "12:35", nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  actualTime?: string | null;

  @ApiPropertyOptional({
    example: "Student refused after two attempts.",
    nullable: true,
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string | null;

  @ApiPropertyOptional({
    example: "123e4567-e89b-12d3-a456-426614174005",
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  correctionOfLogId?: string | null;
}
