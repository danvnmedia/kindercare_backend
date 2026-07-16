import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, Type } from "class-transformer";

import {
  StudentHealthConditionCategory,
  StudentHealthEventStatus,
  StudentHealthEventType,
  StudentHealthInstructionStatus,
  StudentHealthInstructionType,
  formatDateOnly,
} from "@/domain/student-health";

import { MedicationAdministrationQueueItemResponse } from "../medication/medication-administration.response";
import { StudentHealthEventUserResponse } from "./student-health-event.response";
import { StudentHealthInstructionUserResponse } from "./student-health-instruction.response";

export class HealthCenterStudentSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Alice Student" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  avatarUrl: string | null;
}

export class HealthCenterClassSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174100" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Sunflower" })
  name: string;
}

export class HealthCenterInstructionItemResponse {
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
  @Type(() => HealthCenterStudentSummaryResponse)
  @ApiProperty({ type: HealthCenterStudentSummaryResponse })
  student: HealthCenterStudentSummaryResponse;

  @Expose()
  @Type(() => HealthCenterClassSummaryResponse)
  @ApiProperty({ type: HealthCenterClassSummaryResponse, nullable: true })
  class: HealthCenterClassSummaryResponse | null;

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
  @Transform(({ value }) => formatHealthCenterDateOnly(value))
  @ApiProperty({ example: "2026-07-01" })
  startDate: string;

  @Expose()
  @Transform(({ value }) => formatHealthCenterDateOnly(value))
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

export class HealthCenterEventItemResponse {
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
  @Type(() => HealthCenterStudentSummaryResponse)
  @ApiProperty({ type: HealthCenterStudentSummaryResponse })
  student: HealthCenterStudentSummaryResponse;

  @Expose()
  @Type(() => HealthCenterClassSummaryResponse)
  @ApiProperty({ type: HealthCenterClassSummaryResponse, nullable: true })
  class: HealthCenterClassSummaryResponse | null;

  @Expose()
  @ApiProperty({
    enum: StudentHealthEventType,
    example: StudentHealthEventType.ILLNESS,
  })
  eventType: StudentHealthEventType;

  @Expose()
  @ApiProperty({
    enum: StudentHealthConditionCategory,
    example: StudentHealthConditionCategory.EYE,
    nullable: true,
  })
  category: StudentHealthConditionCategory | null;

  @Expose()
  @ApiProperty({ example: "Eye redness observed" })
  title: string;

  @Expose()
  @ApiProperty({
    example: "Teacher noticed redness in the left eye after nap time.",
    nullable: true,
  })
  description: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:00:00.000Z" })
  occurredAt: Date;

  @Expose()
  @ApiProperty({
    enum: StudentHealthEventStatus,
    example: StudentHealthEventStatus.OPEN,
  })
  status: StudentHealthEventStatus;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  resolutionNotes: string | null;

  @Expose()
  @Type(() => StudentHealthEventUserResponse)
  @ApiProperty({ type: StudentHealthEventUserResponse, nullable: true })
  recordedBy: StudentHealthEventUserResponse | null;

  @Expose()
  @Type(() => StudentHealthEventUserResponse)
  @ApiProperty({ type: StudentHealthEventUserResponse, nullable: true })
  lastUpdatedBy: StudentHealthEventUserResponse | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:10:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:10:00.000Z" })
  updatedAt: Date;
}

export class HealthCenterDailyItemsCountsResponse {
  @Expose()
  @ApiProperty({ example: 12 })
  instructions: number;

  @Expose()
  @ApiProperty({ example: 3 })
  events: number;

  @Expose()
  @ApiProperty({ example: 15 })
  total: number;

  @Expose()
  @ApiProperty({ example: 8 })
  medicationAdministrations: number;

  @Expose()
  @ApiProperty({ example: 6 })
  dueMedicationAdministrations: number;

  @Expose()
  @ApiProperty({ example: 2 })
  overdueMedicationAdministrations: number;

  @Expose()
  @ApiProperty({ example: 3 })
  requestsNeedingReview: number;

  @Expose()
  @ApiProperty({ example: 23 })
  visibleTotal: number;

  @Expose()
  @ApiProperty({ example: 11 })
  actionRequired: number;
}

export class HealthCenterDailyItemsAccessResponse {
  @Expose()
  @ApiProperty({ example: true })
  healthItems: boolean;

  @Expose()
  @ApiProperty({ example: true })
  medicationAdministrations: boolean;

  @Expose()
  @ApiProperty({ example: true })
  medicationRequests: boolean;

  @Expose()
  @ApiProperty({ example: true })
  canRecordMedication: boolean;

  @Expose()
  @ApiProperty({ example: true })
  canReviewMedicationRequests: boolean;
}

export class HealthCenterPaginationGroupResponse {
  @Expose()
  @ApiProperty({ example: 0 })
  offset: number;

  @Expose()
  @ApiProperty({ example: 50 })
  limit: number;

  @Expose()
  @ApiProperty({ example: 12 })
  total: number;

  @Expose()
  @ApiProperty({ example: false })
  hasMore: boolean;
}

export class HealthCenterDailyItemsPaginationResponse {
  @Expose()
  @Type(() => HealthCenterPaginationGroupResponse)
  @ApiProperty({ type: HealthCenterPaginationGroupResponse })
  instructions: HealthCenterPaginationGroupResponse;

  @Expose()
  @Type(() => HealthCenterPaginationGroupResponse)
  @ApiProperty({ type: HealthCenterPaginationGroupResponse })
  events: HealthCenterPaginationGroupResponse;

  @Expose()
  @Type(() => HealthCenterPaginationGroupResponse)
  @ApiProperty({ type: HealthCenterPaginationGroupResponse })
  medicationAdministrations: HealthCenterPaginationGroupResponse;
}

export class HealthCenterDailyItemsResponseDto {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "2026-07-01" })
  date: string;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174100",
    nullable: true,
  })
  classId: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T15:30:00.000Z" })
  generatedAt: string;

  @Expose()
  @Type(() => HealthCenterDailyItemsAccessResponse)
  @ApiProperty({ type: HealthCenterDailyItemsAccessResponse })
  access: HealthCenterDailyItemsAccessResponse;

  @Expose()
  @Type(() => HealthCenterDailyItemsCountsResponse)
  @ApiProperty({ type: HealthCenterDailyItemsCountsResponse })
  counts: HealthCenterDailyItemsCountsResponse;

  @Expose()
  @Type(() => HealthCenterDailyItemsPaginationResponse)
  @ApiProperty({ type: HealthCenterDailyItemsPaginationResponse })
  pagination: HealthCenterDailyItemsPaginationResponse;

  @Expose()
  @Type(() => HealthCenterInstructionItemResponse)
  @ApiProperty({ type: [HealthCenterInstructionItemResponse] })
  instructions: HealthCenterInstructionItemResponse[];

  @Expose()
  @Type(() => HealthCenterEventItemResponse)
  @ApiProperty({ type: [HealthCenterEventItemResponse] })
  events: HealthCenterEventItemResponse[];

  @Expose()
  @Type(() => MedicationAdministrationQueueItemResponse)
  @ApiProperty({ type: [MedicationAdministrationQueueItemResponse] })
  medicationAdministrations: MedicationAdministrationQueueItemResponse[];
}

function formatHealthCenterDateOnly(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return value.slice(0, 10);
    }
  }
  return formatDateOnly(value as Date | string | null);
}
