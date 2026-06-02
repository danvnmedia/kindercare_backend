import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { StaffTypeSummaryDto } from "../staff-type/staff-type-summary.dto";

export class StaffResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  campusId: string;

  @Expose()
  @ApiProperty({
    example: "ST-2025-000001",
    description: "Campus-scoped, immutable staff code in format ST-YYYY-XXXXXX",
  })
  staffCode: string;

  @Expose()
  @ApiProperty({ example: "Nguyễn Văn A" })
  fullName: string;

  @Expose()
  @ApiProperty({ example: "staff@example.com" })
  email: string;

  @Expose()
  @ApiProperty({ example: "+84912345678" })
  phoneNumber: string;

  @Expose()
  @Type(() => StaffTypeSummaryDto)
  @ApiProperty({
    type: StaffTypeSummaryDto,
    isArray: true,
    description:
      "Read-only snapshots of the staff member's staff types (id + name), sorted by StaffType.order ASC. The write path is `staffTypeIds: string[]` on the request DTOs — see @doc/specs/staff-multi-type-refactor (D1).",
  })
  staffTypes: StaffTypeSummaryDto[];

  @Expose()
  @ApiProperty({ example: "123 Đường ABC, Quận 1, TP.HCM", nullable: true })
  address: string | null;

  @Expose()
  @ApiProperty({ example: "1990-01-15T00:00:00.000Z", nullable: true })
  dateOfBirth: Date | null;

  @Expose()
  @ApiProperty({ example: "MALE", nullable: true })
  gender: string | null;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174001",
    nullable: true,
  })
  userId: string | null;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
