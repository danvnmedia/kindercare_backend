import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";

import { EnrollmentResponse } from "./enrollment.response";
import { SchoolYearEnrollmentResponse } from "./school-year-enrollment.response";

export class CancelSchoolYearEnrollmentResponse {
  @Expose()
  @ApiProperty({
    enum: [EnrollmentEffectiveStatus.CANCELLED],
    example: EnrollmentEffectiveStatus.CANCELLED,
  })
  resultStatus: typeof EnrollmentEffectiveStatus.CANCELLED;

  @Expose()
  @Type(() => SchoolYearEnrollmentResponse)
  @ApiProperty({ type: SchoolYearEnrollmentResponse })
  parent: SchoolYearEnrollmentResponse;

  @Expose()
  @Type(() => EnrollmentResponse)
  @ApiProperty({ type: EnrollmentResponse, isArray: true })
  affectedChildren: EnrollmentResponse[];

  @Expose()
  @ApiProperty({
    type: String,
    isArray: true,
    example: ["123e4567-e89b-12d3-a456-426614174000"],
  })
  affectedChildIds: string[];

  @Expose()
  @ApiProperty({ example: 1, minimum: 0 })
  affectedChildCount: number;

  @Expose()
  @ApiProperty({
    example: false,
    description:
      "True when this response replays an earlier successful cancellation. Replays do not create another audit event.",
  })
  idempotentReplay: boolean;
}
