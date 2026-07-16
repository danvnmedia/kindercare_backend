import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { StudentHealthCheckupType } from "@/domain/student-health";

export class StudentHealthCheckupUserResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "School Nurse", nullable: true })
  fullName: string | null;
}

export class StudentHealthCheckupResponse {
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
    enum: StudentHealthCheckupType,
    example: StudentHealthCheckupType.GENERAL,
  })
  checkupType: StudentHealthCheckupType;

  @Expose()
  @ApiProperty({ example: "2026-07-01T09:00:00.000Z" })
  checkedAt: Date;

  @Expose()
  @ApiProperty({ example: 108.5, nullable: true })
  heightCm: number | null;

  @Expose()
  @ApiProperty({ example: 18.6, nullable: true })
  weightKg: number | null;

  @Expose()
  @ApiProperty({ example: "Routine measurement.", nullable: true })
  notes: string | null;

  @Expose()
  @Type(() => StudentHealthCheckupUserResponse)
  @ApiProperty({
    type: StudentHealthCheckupUserResponse,
    nullable: true,
  })
  recordedBy: StudentHealthCheckupUserResponse | null;

  @Expose()
  @Type(() => StudentHealthCheckupUserResponse)
  @ApiProperty({
    type: StudentHealthCheckupUserResponse,
    nullable: true,
  })
  lastUpdatedBy: StudentHealthCheckupUserResponse | null;

  @Expose()
  @ApiProperty({
    description: "Archive timestamp; null while the checkup is active.",
    example: "2026-07-02T10:00:00.000Z",
    nullable: true,
  })
  archivedAt: Date | null;

  @Expose()
  @ApiProperty({
    description: "User who archived the checkup; null while active.",
    example: "123e4567-e89b-12d3-a456-426614174003",
    nullable: true,
  })
  archivedByUserId: string | null;

  @Expose()
  @ApiProperty({
    description: "Derived from archivedAt; false when archivedAt is null.",
    example: false,
  })
  isArchived: boolean;

  @Expose()
  @ApiProperty({ example: "2026-07-01T09:05:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2026-07-01T09:05:00.000Z" })
  updatedAt: Date;
}
