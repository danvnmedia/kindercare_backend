import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform, Type } from "class-transformer";

import {
  MedicationAdministrationOutcome,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
} from "@/domain/medication";

import { formatMedicationResponseDateOnly } from "./medication-date-only.response";

export class MedicationRequestStudentSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Ava Nguyen" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "S-0001", nullable: true })
  studentCode: string | null;
}

export class MedicationRequestGuardianSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Linh Nguyen" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "parent@example.com", nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ example: "+14165550100", nullable: true })
  phoneNumber: string | null;
}

export class MedicationRequestUserSummaryResponse {
  @Expose()
  @ApiProperty({ example: "44444444-4444-4444-a444-444444444444" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Avery Nurse", nullable: true })
  name: string | null;

  @Expose()
  @ApiProperty({ example: "staff@example.com", nullable: true })
  email: string | null;
}

export class MedicationRequestItemResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

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
  @ApiProperty({ example: ["12:30"], type: [String] })
  timesOfDay: string[];

  @Expose()
  @ApiProperty({ example: "After lunch only.", nullable: true })
  scheduleNotes: string | null;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  notes: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:30:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:30:00.000Z" })
  updatedAt: Date;
}

export class MedicationRequestTimelineEntryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174004" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
  requestId: string;

  @Expose()
  @ApiProperty({ example: "11111111-1111-4111-a111-111111111111" })
  campusId: string;

  @Expose()
  @ApiProperty({
    enum: MedicationRequestTimelineActorType,
    example: MedicationRequestTimelineActorType.GUARDIAN,
  })
  actorType: MedicationRequestTimelineActorType;

  @Expose()
  @ApiProperty({
    example: "44444444-4444-4444-a444-444444444444",
    nullable: true,
  })
  actorUserId: string | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
  })
  actorGuardianId: string | null;

  @Expose()
  @ApiProperty({
    enum: MedicationRequestTimelineAction,
    example: MedicationRequestTimelineAction.PARENT_RESPONDED,
  })
  action: MedicationRequestTimelineAction;

  @Expose()
  @ApiProperty({
    example: "Doctor confirmed the lunch dosage should be 5 ml.",
    nullable: true,
  })
  note: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:30:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:30:00.000Z" })
  updatedAt: Date;
}

export class MedicationRequestAdministrationLogResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174010" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174009" })
  occurrenceId: string;

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
  @Type(() => MedicationRequestUserSummaryResponse)
  @ApiProperty({
    type: MedicationRequestUserSummaryResponse,
    nullable: true,
  })
  recordedByUser: MedicationRequestUserSummaryResponse | null;

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
    example: "123e4567-e89b-12d3-a456-426614174008",
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

export class MedicationRequestOccurrenceResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174009" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
  requestId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  medicationItemId: string;

  @Expose()
  @ApiProperty({ example: "11111111-1111-4111-a111-111111111111" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  studentId: string;

  @Expose()
  @Transform(({ value }) => formatMedicationResponseDateOnly(value))
  @ApiProperty({ example: "2026-07-01" })
  dueDate: string;

  @Expose()
  @ApiProperty({ example: "12:30" })
  dueTime: string;

  @Expose()
  @ApiProperty({
    enum: MedicationAdministrationOutcome,
    example: MedicationAdministrationOutcome.GIVEN,
    nullable: true,
  })
  latestOutcome: MedicationAdministrationOutcome | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174010",
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
  @Type(() => MedicationRequestAdministrationLogResponse)
  @ApiProperty({ type: [MedicationRequestAdministrationLogResponse] })
  logs: MedicationRequestAdministrationLogResponse[];

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:30:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T05:35:00.000Z" })
  updatedAt: Date;
}

export class MedicationRequestResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
  id: string;

  @Expose()
  @ApiProperty({ example: "11111111-1111-4111-a111-111111111111" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  studentId: string;

  @Expose()
  @Type(() => MedicationRequestStudentSummaryResponse)
  @ApiProperty({
    type: MedicationRequestStudentSummaryResponse,
    nullable: true,
  })
  student: MedicationRequestStudentSummaryResponse | null;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  requesterGuardianId: string;

  @Expose()
  @Type(() => MedicationRequestGuardianSummaryResponse)
  @ApiProperty({
    type: MedicationRequestGuardianSummaryResponse,
    nullable: true,
  })
  requesterGuardian: MedicationRequestGuardianSummaryResponse | null;

  @Expose()
  @ApiProperty({
    enum: MedicationRequestStatus,
    example: MedicationRequestStatus.SUBMITTED,
    description:
      "Lifecycle status, including terminal COMPLETED and EXPIRED states.",
  })
  status: MedicationRequestStatus;

  @Expose()
  @Transform(({ value }) => formatMedicationResponseDateOnly(value))
  @ApiProperty({ example: "2026-07-01" })
  startDate: string;

  @Expose()
  @Transform(({ value }) => formatMedicationResponseDateOnly(value))
  @ApiProperty({ example: "2026-07-05" })
  endDate: string;

  @Expose()
  @ApiProperty({ example: "Fever after doctor visit", nullable: true })
  reason: string | null;

  @Expose()
  @ApiProperty({ example: "Call me if vomiting occurs.", nullable: true })
  parentNotes: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T15:00:00.000Z", nullable: true })
  reviewedAt: Date | null;

  @Expose()
  @ApiProperty({
    example: "Please confirm dosage after lunch.",
    nullable: true,
  })
  reviewNote: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T15:05:00.000Z", nullable: true })
  cancelledAt: Date | null;

  @Expose()
  @ApiProperty({ example: "Medication no longer needed.", nullable: true })
  cancelReason: string | null;

  @Expose()
  @ApiProperty({
    description:
      "Effective campus-local final-occurrence boundary for a COMPLETED request; otherwise null.",
    example: "2026-07-05T05:30:00.000Z",
    nullable: true,
  })
  completedAt: Date | null;

  @Expose()
  @ApiProperty({
    description:
      "Effective campus-local end-of-request boundary for an EXPIRED request; otherwise null.",
    example: "2026-07-06T04:00:00.000Z",
    nullable: true,
  })
  expiredAt: Date | null;

  @Expose()
  @Type(() => MedicationRequestItemResponse)
  @ApiProperty({ type: [MedicationRequestItemResponse] })
  items: MedicationRequestItemResponse[];

  @Expose()
  @Type(() => MedicationRequestTimelineEntryResponse)
  @ApiProperty({ type: [MedicationRequestTimelineEntryResponse] })
  timelineEntries: MedicationRequestTimelineEntryResponse[];

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:30:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:30:00.000Z" })
  updatedAt: Date;
}

export class MedicationRequestDetailResponse extends MedicationRequestResponse {
  @Expose()
  @Type(() => MedicationRequestUserSummaryResponse)
  @ApiProperty({
    type: MedicationRequestUserSummaryResponse,
    nullable: true,
  })
  reviewedByUser: MedicationRequestUserSummaryResponse | null;

  @Expose()
  @Type(() => MedicationRequestOccurrenceResponse)
  @ApiProperty({ type: [MedicationRequestOccurrenceResponse] })
  occurrences: MedicationRequestOccurrenceResponse[];
}

export class ParentMedicationRequestDetailResponse extends MedicationRequestResponse {
  @Expose()
  @Type(() => MedicationRequestOccurrenceResponse)
  @ApiProperty({ type: [MedicationRequestOccurrenceResponse] })
  occurrences: MedicationRequestOccurrenceResponse[];
}
