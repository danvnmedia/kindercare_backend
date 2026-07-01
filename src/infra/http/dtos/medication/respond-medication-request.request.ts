import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RespondMedicationRequestRequest {
  @ApiProperty({
    example: "Doctor confirmed the lunch dosage should be 5 ml.",
    maxLength: 4000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;
}
