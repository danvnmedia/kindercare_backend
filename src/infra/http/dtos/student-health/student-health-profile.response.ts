import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  StudentHealthAllergySeverity,
  StudentHealthConditionCategory,
  StudentHealthConditionStatus,
  StudentHealthRestrictionType,
} from "@/domain/student-health";

export class StudentHealthAllergyResponse {
  @Expose()
  @ApiProperty({ example: "Peanuts" })
  name: string;

  @Expose()
  @ApiProperty({
    enum: StudentHealthAllergySeverity,
    example: StudentHealthAllergySeverity.SEVERE,
  })
  severity: StudentHealthAllergySeverity;

  @Expose()
  @ApiProperty({ example: "Rash", nullable: true })
  reaction: string | null;

  @Expose()
  @ApiProperty({ example: "Avoid peanut snacks.", nullable: true })
  notes: string | null;
}

export class StudentHealthConditionResponse {
  @Expose()
  @ApiProperty({
    enum: StudentHealthConditionCategory,
    example: StudentHealthConditionCategory.EYE,
  })
  category: StudentHealthConditionCategory;

  @Expose()
  @ApiProperty({ example: "Near-sightedness" })
  name: string;

  @Expose()
  @ApiProperty({
    enum: StudentHealthConditionStatus,
    example: StudentHealthConditionStatus.MONITORING,
  })
  status: StudentHealthConditionStatus;

  @Expose()
  @ApiProperty({ example: "Wears glasses in class.", nullable: true })
  notes: string | null;
}

export class StudentHealthRestrictionResponse {
  @Expose()
  @ApiProperty({
    enum: StudentHealthRestrictionType,
    example: StudentHealthRestrictionType.FOOD,
  })
  type: StudentHealthRestrictionType;

  @Expose()
  @ApiProperty({ example: "No tree nuts" })
  description: string;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  notes: string | null;
}

export class StudentHealthProfileLastUpdatedByResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "School Nurse", nullable: true })
  fullName: string | null;
}

export class StudentHealthProfileResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  studentId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  campusId: string;

  @Expose()
  @Type(() => StudentHealthAllergyResponse)
  @ApiProperty({ type: [StudentHealthAllergyResponse] })
  allergies: StudentHealthAllergyResponse[];

  @Expose()
  @Type(() => StudentHealthConditionResponse)
  @ApiProperty({ type: [StudentHealthConditionResponse] })
  conditions: StudentHealthConditionResponse[];

  @Expose()
  @Type(() => StudentHealthRestrictionResponse)
  @ApiProperty({ type: [StudentHealthRestrictionResponse] })
  restrictions: StudentHealthRestrictionResponse[];

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  emergencyNotes: string | null;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  lastUpdatedAt: Date | null;

  @Expose()
  @Type(() => StudentHealthProfileLastUpdatedByResponse)
  @ApiProperty({
    type: StudentHealthProfileLastUpdatedByResponse,
    nullable: true,
  })
  lastUpdatedBy: StudentHealthProfileLastUpdatedByResponse | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T08:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T08:00:00.000Z" })
  updatedAt: Date;
}
