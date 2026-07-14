import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { AttendanceRollCallState, AttendanceStatus } from "@/domain/attendance";
import {
  RollCallSaveReasonCode,
  RollCallSaveResultStatus,
  SaveClassRollCallResult,
  SaveClassRollCallRowResult,
} from "@/application/attendance/use-cases/save-class-roll-call.use-case";

export class SaveClassRollCallRowResponse
  implements SaveClassRollCallRowResult
{
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  studentId: string;

  @Expose()
  @ApiProperty({
    enum: RollCallSaveResultStatus,
    example: RollCallSaveResultStatus.SAVED,
  })
  result: RollCallSaveResultStatus;

  @Expose()
  @ApiProperty({
    enum: RollCallSaveReasonCode,
    example: RollCallSaveReasonCode.NOT_IDENTIFIED_NOOP,
    nullable: true,
  })
  reasonCode: RollCallSaveReasonCode | null;

  @Expose()
  @ApiProperty({
    enum: AttendanceRollCallState,
    example: AttendanceRollCallState.IN_CLASS,
  })
  state: AttendanceRollCallState;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
  })
  attendanceId: string | null;

  @Expose()
  @ApiProperty({ enum: AttendanceStatus, nullable: true })
  attendanceStatus: AttendanceStatus | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174002",
    nullable: true,
  })
  absenceRequestId: string | null;
}

export class SaveClassRollCallResponse implements SaveClassRollCallResult {
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
  @Type(() => SaveClassRollCallRowResponse)
  @ApiProperty({ type: [SaveClassRollCallRowResponse] })
  rows: SaveClassRollCallRowResponse[];

  static fromUseCase(
    result: SaveClassRollCallResult,
  ): SaveClassRollCallResponse {
    return {
      campusId: result.campusId,
      classId: result.classId,
      date: result.date,
      rows: result.rows,
    };
  }
}
