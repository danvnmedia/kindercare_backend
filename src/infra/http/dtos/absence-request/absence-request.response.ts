import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import {
  AbsenceRequestStatus,
  AbsenceRequestType,
} from "@/domain/absence-request";

export class AbsenceRequestStudentSummaryResponse {
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

export class AbsenceRequestGuardianSummaryResponse {
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

export class AbsenceRequestReviewerSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

  @Expose()
  @ApiProperty({ example: "admin@example.com", nullable: true })
  name: string | null;

  @Expose()
  @ApiProperty({ example: "admin@example.com", nullable: true })
  email: string | null;
}

export class AbsenceRequestResponse {
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
  @Type(() => AbsenceRequestStudentSummaryResponse)
  @ApiProperty({ type: AbsenceRequestStudentSummaryResponse, nullable: true })
  student: AbsenceRequestStudentSummaryResponse | null;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  requesterGuardianId: string;

  @Expose()
  @Type(() => AbsenceRequestGuardianSummaryResponse)
  @ApiProperty({ type: AbsenceRequestGuardianSummaryResponse, nullable: true })
  requesterGuardian: AbsenceRequestGuardianSummaryResponse | null;

  @Expose()
  @ApiProperty({
    enum: AbsenceRequestType,
    example: AbsenceRequestType.FULL_DAY,
  })
  absenceType: AbsenceRequestType;

  @Expose()
  @ApiProperty({ example: "2026-07-10T00:00:00.000Z" })
  startDate: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-10T00:00:00.000Z" })
  endDate: Date;

  @Expose()
  @ApiProperty({ example: "09:00", nullable: true })
  startTime: string | null;

  @Expose()
  @ApiProperty({ example: "12:30", nullable: true })
  endTime: string | null;

  @Expose()
  @ApiProperty({ example: "Family appointment." })
  description: string;

  @Expose()
  @ApiProperty({
    enum: AbsenceRequestStatus,
    example: AbsenceRequestStatus.PENDING,
  })
  status: AbsenceRequestStatus;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174002",
    nullable: true,
  })
  reviewedById: string | null;

  @Expose()
  @Type(() => AbsenceRequestReviewerSummaryResponse)
  @ApiProperty({ type: AbsenceRequestReviewerSummaryResponse, nullable: true })
  reviewedBy: AbsenceRequestReviewerSummaryResponse | null;

  @Expose()
  @ApiProperty({ example: "2026-07-10T14:30:00.000Z", nullable: true })
  reviewedAt: Date | null;

  @Expose()
  @ApiProperty({ example: "Approved by office.", nullable: true })
  reviewNote: string | null;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:30:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T14:30:00.000Z" })
  updatedAt: Date;
}
