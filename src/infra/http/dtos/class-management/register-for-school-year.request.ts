import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class RegisterForSchoolYearRequest {
  @ApiProperty({
    description: "School year UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  schoolYearId: string;

  @ApiProperty({
    description: "Grade level UUID the student is being placed in",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsNotEmpty()
  @IsUUID()
  gradeLevelId: string;

  @ApiProperty({
    description:
      "Date the student is registered for this school year. Must fall within the school year's start/end range.",
    example: "2025-09-01",
  })
  @IsNotEmpty()
  @IsDateString()
  enrollmentDate: string;

  @ApiProperty({
    description: "Optional note attached to the registration",
    example: "Late registration approved by principal",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
