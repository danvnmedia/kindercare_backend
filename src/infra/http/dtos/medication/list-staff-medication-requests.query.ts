import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { MedicationRequestStatus } from "@/domain/medication";

export class ListStaffMedicationRequestsQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    enum: MedicationRequestStatus,
    example: MedicationRequestStatus.SUBMITTED,
  })
  @IsOptional()
  @IsEnum(MedicationRequestStatus)
  status?: MedicationRequestStatus;

  @ApiPropertyOptional({
    example: "22222222-2222-4222-a222-222222222222",
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    example: "99999999-9999-4999-a999-999999999999",
  })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({ example: "2099-07-01" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({ example: "2099-07-31" })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @ApiPropertyOptional({ example: "Antibiotic syrup" })
  @IsOptional()
  @IsString()
  search?: string;
}
