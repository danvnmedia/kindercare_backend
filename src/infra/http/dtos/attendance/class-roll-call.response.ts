import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { AttendanceRollCallState, AttendanceStatus } from "@/domain/attendance";
import {
  AttendanceApprovedAbsenceContext,
  AttendanceChangeLogView,
  AttendanceRollCallRow,
  AttendanceRollCallStudent,
  AttendanceTimelineActor,
  ClassRollCallSheet,
} from "@/application/attendance/use-cases/get-class-roll-call.use-case";

export class AttendanceTimelineActorResponse
  implements AttendanceTimelineActor
{
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyen Van A" })
  displayName: string;

  @Expose()
  @ApiProperty({ example: "teacher@example.com", nullable: true })
  email: string | null;
}

export class AttendanceRollCallStudentResponse
  implements AttendanceRollCallStudent
{
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Nguyen Van A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "Be A", nullable: true })
  nickname: string | null;

  @Expose()
  @ApiProperty({ example: "STU001", nullable: true })
  studentCode: string | null;
}

export class AttendanceApprovedAbsenceResponse
  implements AttendanceApprovedAbsenceContext
{
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "FULL_DAY" })
  absenceType: string;

  @Expose()
  @ApiProperty({ example: "2026-07-06" })
  startDate: string;

  @Expose()
  @ApiProperty({ example: "2026-07-06" })
  endDate: string;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  startMinute: number | null;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  endMinute: number | null;

  @Expose()
  @ApiProperty({ example: "Family trip" })
  description: string;

  @Expose()
  @ApiProperty({ example: "2026-07-05T03:00:00.000Z", nullable: true })
  reviewedAt: Date | null;

  @Expose()
  @ApiProperty({ example: "Approved", nullable: true })
  reviewNote: string | null;
}

export class AttendanceChangeLogResponse implements AttendanceChangeLogView {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "STATUS_CHANGED" })
  changeType: string;

  @Expose()
  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  previousValue: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ type: "object", additionalProperties: true, nullable: true })
  newValue: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  actorId: string;

  @Expose()
  @Type(() => AttendanceTimelineActorResponse)
  @ApiProperty({ type: AttendanceTimelineActorResponse, nullable: true })
  actor: AttendanceTimelineActorResponse | null;

  @Expose()
  @ApiProperty({
    example: "Corrected after parent confirmation",
    nullable: true,
  })
  note: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-06T02:30:00.000Z" })
  createdAt: Date;
}

export class AttendanceRollCallRowResponse implements AttendanceRollCallRow {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  studentId: string;

  @Expose()
  @Type(() => AttendanceRollCallStudentResponse)
  @ApiProperty({ type: AttendanceRollCallStudentResponse })
  student: AttendanceRollCallStudentResponse;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  classId: string;

  @Expose()
  @ApiProperty({ example: "2026-07-06" })
  date: string;

  @Expose()
  @ApiProperty({
    enum: AttendanceRollCallState,
    example: AttendanceRollCallState.NOT_IDENTIFIED,
  })
  state: AttendanceRollCallState;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174002",
    nullable: true,
  })
  attendanceId: string | null;

  @Expose()
  @ApiProperty({ enum: AttendanceStatus, nullable: true })
  attendanceStatus: AttendanceStatus | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174003",
    nullable: true,
  })
  absenceRequestId: string | null;

  @Expose()
  @Type(() => AttendanceApprovedAbsenceResponse)
  @ApiProperty({ type: AttendanceApprovedAbsenceResponse, nullable: true })
  approvedAbsence: AttendanceApprovedAbsenceResponse | null;

  @Expose()
  @ApiProperty({ example: false })
  hasApprovedAbsenceWarning: boolean;

  @Expose()
  @ApiProperty({ example: "Parent called ahead", nullable: true })
  note: string | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174004",
    nullable: true,
  })
  updatedById: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-06T02:30:00.000Z", nullable: true })
  updatedAt: Date | null;

  @Expose()
  @Type(() => AttendanceChangeLogResponse)
  @ApiProperty({ type: [AttendanceChangeLogResponse] })
  timeline: AttendanceChangeLogResponse[];
}

export class ClassRollCallResponse implements ClassRollCallSheet {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  classId: string;

  @Expose()
  @ApiProperty({ example: "2026-07-06" })
  date: string;

  @Expose()
  @Type(() => AttendanceRollCallRowResponse)
  @ApiProperty({ type: [AttendanceRollCallRowResponse] })
  rows: AttendanceRollCallRowResponse[];

  static fromUseCase(sheet: ClassRollCallSheet): ClassRollCallResponse {
    return {
      campusId: sheet.campusId,
      classId: sheet.classId,
      date: sheet.date,
      rows: sheet.rows,
    };
  }
}
