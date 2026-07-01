import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

import {
  StudentHealthAllergySeverity,
  StudentHealthConditionCategory,
  StudentHealthConditionStatus,
  StudentHealthRestrictionType,
} from "@/domain/student-health";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class StudentHealthAllergyRequest {
  @ApiProperty({ example: "Peanuts" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: StudentHealthAllergySeverity,
    example: StudentHealthAllergySeverity.SEVERE,
  })
  @Transform(({ value }) => trimString(value))
  @IsEnum(StudentHealthAllergySeverity)
  severity: StudentHealthAllergySeverity;

  @ApiProperty({
    example: "Rash and breathing difficulty",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  reaction?: string | null;

  @ApiProperty({
    example: "Avoid peanut snacks.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class StudentHealthConditionRequest {
  @ApiProperty({
    enum: StudentHealthConditionCategory,
    example: StudentHealthConditionCategory.EYE,
  })
  @Transform(({ value }) => trimString(value))
  @IsEnum(StudentHealthConditionCategory)
  category: StudentHealthConditionCategory;

  @ApiProperty({ example: "Near-sightedness" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: StudentHealthConditionStatus,
    example: StudentHealthConditionStatus.MONITORING,
  })
  @Transform(({ value }) => trimString(value))
  @IsEnum(StudentHealthConditionStatus)
  status: StudentHealthConditionStatus;

  @ApiProperty({
    example: "Wears glasses in class.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class StudentHealthRestrictionRequest {
  @ApiProperty({
    enum: StudentHealthRestrictionType,
    example: StudentHealthRestrictionType.FOOD,
  })
  @Transform(({ value }) => trimString(value))
  @IsEnum(StudentHealthRestrictionType)
  type: StudentHealthRestrictionType;

  @ApiProperty({ example: "No tree nuts" })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: null, required: false, nullable: true })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateStudentHealthProfileRequest {
  @ApiProperty({
    type: [StudentHealthAllergyRequest],
    required: false,
    description: "Full replacement allergy list. Empty array clears allergies.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentHealthAllergyRequest)
  allergies?: StudentHealthAllergyRequest[];

  @ApiProperty({
    type: [StudentHealthConditionRequest],
    required: false,
    description:
      "Full replacement condition list. Empty array clears conditions.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentHealthConditionRequest)
  conditions?: StudentHealthConditionRequest[];

  @ApiProperty({
    type: [StudentHealthRestrictionRequest],
    required: false,
    description:
      "Full replacement restriction list. Empty array clears restrictions.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StudentHealthRestrictionRequest)
  restrictions?: StudentHealthRestrictionRequest[];

  @ApiProperty({
    example: "Carry inhaler if outdoor activity is intense.",
    required: false,
    nullable: true,
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  emergencyNotes?: string | null;
}
