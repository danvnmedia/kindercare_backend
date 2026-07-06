import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, Type } from "class-transformer";

import {
  StudentHealthInstructionStatus,
  StudentHealthInstructionType,
  formatDateOnly,
} from "@/domain/student-health";

export class StudentHealthInstructionUserResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "School Nurse", nullable: true })
  fullName: string | null;
}

export class StudentHealthInstructionResponse {
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
  @ApiProperty({
    enum: StudentHealthInstructionType,
    example: StudentHealthInstructionType.MEDICATION,
  })
  instructionType: StudentHealthInstructionType;

  @Expose()
  @ApiProperty({ example: "Antibiotic after lunch" })
  title: string;

  @Expose()
  @ApiProperty({ example: "Give the medication after lunch with water." })
  instruction: string;

  @Expose()
  @ApiProperty({ example: "5 ml", nullable: true })
  dosage: string | null;

  @Expose()
  @Transform(({ value }) => formatInstructionDateOnly(value))
  @ApiProperty({ example: "2026-07-01" })
  startDate: string;

  @Expose()
  @Transform(({ value }) => formatInstructionDateOnly(value))
  @ApiProperty({ example: "2026-07-05", nullable: true })
  endDate: string | null;

  @Expose()
  @ApiProperty({ example: ["12:30"], type: [String] })
  timesOfDay: string[];

  @Expose()
  @ApiProperty({ example: "After lunch only.", nullable: true })
  scheduleNotes: string | null;

  @Expose()
  @ApiProperty({ example: "Call guardian if vomiting occurs.", nullable: true })
  notes: string | null;

  @Expose()
  @ApiProperty({ example: true })
  isActive: boolean;

  @Expose()
  @ApiProperty({
    enum: StudentHealthInstructionStatus,
    example: StudentHealthInstructionStatus.ACTIVE,
  })
  status: StudentHealthInstructionStatus;

  @Expose()
  @Type(() => StudentHealthInstructionUserResponse)
  @ApiProperty({ type: StudentHealthInstructionUserResponse, nullable: true })
  createdBy: StudentHealthInstructionUserResponse | null;

  @Expose()
  @Type(() => StudentHealthInstructionUserResponse)
  @ApiProperty({ type: StudentHealthInstructionUserResponse, nullable: true })
  lastUpdatedBy: StudentHealthInstructionUserResponse | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T08:30:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T08:30:00.000Z" })
  updatedAt: Date;
}

function formatInstructionDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
  }
  return formatDateOnly(value as Date | string | null);
}
