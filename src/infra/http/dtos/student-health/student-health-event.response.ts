import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  StudentHealthConditionCategory,
  StudentHealthEventStatus,
  StudentHealthEventType,
} from "@/domain/student-health";

export class StudentHealthEventUserResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "School Nurse", nullable: true })
  fullName: string | null;
}

export class StudentHealthEventResponse {
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
  @ApiProperty({
    example: "Guardian confirmed follow-up.",
    nullable: true,
  })
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
