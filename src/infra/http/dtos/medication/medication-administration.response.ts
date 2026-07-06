import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, Type } from "class-transformer";

import {
  MedicationAdministrationOutcome,
  MedicationAdministrationStatus,
} from "@/domain/medication";

import { formatMedicationResponseDateOnly } from "./medication-date-only.response";

export class MedicationAdministrationStudentSummaryResponse {
  @Expose()
  @ApiProperty({ example: "22222222-2222-4222-a222-222222222222" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Ava Nguyen" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "S-0001", nullable: true })
  studentCode: string | null;
}

export class MedicationAdministrationClassSummaryResponse {
  @Expose()
  @ApiProperty({ example: "99999999-9999-4999-a999-999999999999" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Sunflower" })
  name: string;
}

export class MedicationAdministrationLogSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174005" })
  id: string;

  @Expose()
  @ApiProperty({
    enum: MedicationAdministrationOutcome,
    example: MedicationAdministrationOutcome.GIVEN,
  })
  outcome: MedicationAdministrationOutcome;

  @Expose()
  @ApiProperty({ example: "44444444-4444-4444-a444-444444444444" })
  recordedByUserId: string;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:35:00.000Z" })
  recordedAt: Date;

  @Expose()
  @ApiProperty({ example: "12:35", nullable: true })
  actualTime: string | null;

  @Expose()
  @ApiProperty({ example: "Given with lunch.", nullable: true })
  note: string | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174004",
    nullable: true,
  })
  correctionOfLogId: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:35:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:35:00.000Z" })
  updatedAt: Date;
}

export class MedicationAdministrationQueueItemResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174010" })
  occurrenceId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174011" })
  requestId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174012" })
  medicationItemId: string;

  @Expose()
  @Type(() => MedicationAdministrationStudentSummaryResponse)
  @ApiProperty({ type: MedicationAdministrationStudentSummaryResponse })
  student: MedicationAdministrationStudentSummaryResponse;

  @Expose()
  @Type(() => MedicationAdministrationClassSummaryResponse)
  @ApiProperty({
    type: MedicationAdministrationClassSummaryResponse,
    nullable: true,
  })
  class: MedicationAdministrationClassSummaryResponse | null;

  @Expose()
  @ApiProperty({ example: "Antibiotic syrup" })
  medicationName: string;

  @Expose()
  @ApiProperty({ example: "5 ml", nullable: true })
  dosage: string | null;

  @Expose()
  @ApiProperty({ example: "Give after lunch with water." })
  instructions: string;

  @Expose()
  @Transform(({ value }) => formatMedicationResponseDateOnly(value))
  @ApiProperty({ example: "2026-07-01" })
  dueDate: string;

  @Expose()
  @ApiProperty({ example: "12:30" })
  dueTime: string;

  @Expose()
  @ApiProperty({
    enum: MedicationAdministrationStatus,
    example: MedicationAdministrationStatus.DUE,
  })
  status: MedicationAdministrationStatus;

  @Expose()
  @ApiProperty({ example: false })
  isOverdue: boolean;

  @Expose()
  @ApiProperty({ example: "Call me if vomiting occurs.", nullable: true })
  parentNotes: string | null;

  @Expose()
  @Type(() => MedicationAdministrationLogSummaryResponse)
  @ApiProperty({
    type: MedicationAdministrationLogSummaryResponse,
    nullable: true,
  })
  latestLog: MedicationAdministrationLogSummaryResponse | null;

  @Expose()
  @ApiProperty({
    enum: MedicationAdministrationOutcome,
    example: MedicationAdministrationOutcome.GIVEN,
    nullable: true,
  })
  latestOutcome: MedicationAdministrationOutcome | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174005",
    nullable: true,
  })
  latestLogId: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:35:00.000Z", nullable: true })
  latestRecordedAt: Date | null;

  @Expose()
  @ApiProperty({
    example: "44444444-4444-4444-a444-444444444444",
    nullable: true,
  })
  latestRecordedByUserId: string | null;

  @Expose()
  @ApiProperty({ example: "Given with lunch.", nullable: true })
  latestNote: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:30:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:35:00.000Z" })
  updatedAt: Date;
}

export class MedicationAdministrationRecordResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174010" })
  occurrenceId: string;

  @Expose()
  @ApiProperty({
    enum: MedicationAdministrationOutcome,
    example: MedicationAdministrationOutcome.GIVEN,
  })
  status: MedicationAdministrationOutcome;

  @Expose()
  @ApiProperty({ example: false })
  isOverdue: boolean;

  @Expose()
  @Type(() => MedicationAdministrationLogSummaryResponse)
  @ApiProperty({ type: MedicationAdministrationLogSummaryResponse })
  latestLog: MedicationAdministrationLogSummaryResponse;

  @Expose()
  @ApiProperty({
    enum: MedicationAdministrationOutcome,
    example: MedicationAdministrationOutcome.GIVEN,
    nullable: true,
  })
  latestOutcome: MedicationAdministrationOutcome | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174005",
    nullable: true,
  })
  latestLogId: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:35:00.000Z", nullable: true })
  latestRecordedAt: Date | null;

  @Expose()
  @ApiProperty({
    example: "44444444-4444-4444-a444-444444444444",
    nullable: true,
  })
  latestRecordedByUserId: string | null;

  @Expose()
  @ApiProperty({ example: "Given with lunch.", nullable: true })
  latestNote: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:35:00.000Z" })
  updatedAt: Date;
}
