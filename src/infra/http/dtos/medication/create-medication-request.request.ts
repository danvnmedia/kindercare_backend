import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class CreateMedicationRequestItemRequest {
  @ApiProperty({ example: "Antibiotic syrup", maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  medicationName: string;

  @ApiProperty({ example: "5 ml", required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  dosage?: string | null;

  @ApiProperty({ example: "Give after lunch with water." })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  instructions: string;

  @ApiProperty({ example: ["12:30"], type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/, { each: true })
  timesOfDay: string[];

  @ApiProperty({
    example: "After lunch only.",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  scheduleNotes?: string | null;

  @ApiProperty({
    example: "Call guardian if vomiting occurs.",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class CreateMedicationRequestRequest {
  @ApiProperty({
    description: "Student UUID linked to the authenticated guardian.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  studentId: string;

  @ApiProperty({
    description: "Date-only medication request start.",
    example: "2026-07-01",
  })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;

  @ApiProperty({
    description: "Date-only medication request end.",
    example: "2026-07-05",
  })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate: string;

  @ApiProperty({
    example: "Fever after doctor visit",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  reason?: string | null;

  @ApiProperty({
    example: "Call me if vomiting occurs.",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  parentNotes?: string | null;

  @ApiProperty({ type: [CreateMedicationRequestItemRequest] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateMedicationRequestItemRequest)
  items: CreateMedicationRequestItemRequest[];
}
