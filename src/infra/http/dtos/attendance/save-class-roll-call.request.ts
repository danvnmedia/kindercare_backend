import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { AttendanceRollCallState } from "@/domain/attendance";

export class SaveClassRollCallRowRequest {
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiProperty({
    description: "V1 roll-call state selected by the teacher or assistant",
    enum: AttendanceRollCallState,
    example: AttendanceRollCallState.IN_CLASS,
  })
  @IsEnum(AttendanceRollCallState)
  state: AttendanceRollCallState;

  @ApiProperty({
    description:
      "Approved absence request ID when state is ABSENCE_WITH_REQUEST",
    example: "123e4567-e89b-12d3-a456-426614174001",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  absenceRequestId?: string | null;

  @ApiProperty({
    description:
      "Optional note. Required when overriding an approved absence to another state.",
    example: "Parent confirmed the student came to class",
    required: false,
    nullable: true,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class SaveClassRollCallRequest {
  @ApiProperty({
    description: "Roll-call date in YYYY-MM-DD format",
    example: "2026-07-06",
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiProperty({
    description: "Rows to save for active students in the class roster",
    type: [SaveClassRollCallRowRequest],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveClassRollCallRowRequest)
  rows: SaveClassRollCallRowRequest[];
}
