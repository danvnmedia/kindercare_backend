import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class CancelMedicationRequestRequest {
  @ApiPropertyOptional({
    example: "Medication no longer needed.",
    nullable: true,
    maxLength: 4000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reason?: string | null;
}
