import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
} from "class-validator";

import { MedicationAdministrationStatus } from "@/domain/medication";

export class ListMedicationAdministrationsQuery {
  @ApiPropertyOptional({ example: "2026-07-01" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @ApiPropertyOptional({
    example: "99999999-9999-4999-a999-999999999999",
  })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({
    example: "22222222-2222-4222-a222-222222222222",
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    enum: MedicationAdministrationStatus,
    example: MedicationAdministrationStatus.DUE,
  })
  @IsOptional()
  @IsEnum(MedicationAdministrationStatus)
  status?: MedicationAdministrationStatus;
}
