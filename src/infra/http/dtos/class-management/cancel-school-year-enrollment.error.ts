import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { SchoolYearEnrollmentCancellationErrorCode } from "@/application/class-management/school-year-enrollment-cancellation";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";

export class CancellationHttpErrorResponse {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
    example: ["cancellationReason must be one of the following values: ..."],
  })
  message: string | string[];

  @ApiProperty({ example: "Bad Request" })
  error: string;
}

export class CancellationBadRequestResponse extends CancellationHttpErrorResponse {
  @ApiProperty({ example: 400 })
  declare statusCode: number;

  @ApiProperty({ example: "Bad Request" })
  declare error: string;
}

export class CancellationForbiddenResponse extends CancellationHttpErrorResponse {
  @ApiProperty({ example: 403 })
  declare statusCode: number;

  @ApiProperty({ example: "Forbidden resource" })
  declare message: string;

  @ApiProperty({ example: "Forbidden" })
  declare error: string;
}

export class CancellationNotFoundResponse extends CancellationHttpErrorResponse {
  @ApiProperty({ example: 404 })
  declare statusCode: number;

  @ApiProperty({ example: "School-year enrollment not found" })
  declare message: string;

  @ApiProperty({ example: "Not Found" })
  declare error: string;
}

export class CancelSchoolYearEnrollmentConflictResponse {
  @ApiProperty({
    enum: Object.values(SchoolYearEnrollmentCancellationErrorCode),
    example:
      SchoolYearEnrollmentCancellationErrorCode.ENROLLMENT_ALREADY_EFFECTIVE,
  })
  code: (typeof SchoolYearEnrollmentCancellationErrorCode)[keyof typeof SchoolYearEnrollmentCancellationErrorCode];

  @ApiPropertyOptional({
    enum: EnrollmentEffectiveStatus,
    example: EnrollmentEffectiveStatus.ACTIVE,
    description:
      "Present when the backend can authoritatively classify the current parent state.",
  })
  currentStatus?: EnrollmentEffectiveStatus;

  @ApiPropertyOptional({
    enum: ["WITHDRAW"],
    example: "WITHDRAW",
    description:
      "Recovery guidance when the registration is already effective or has an active child.",
  })
  action?: "WITHDRAW";

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description:
      "Active child enrollment IDs when CANCELLATION_CHILD_STATE_CONFLICT can identify them.",
  })
  childEnrollmentIds?: string[];
}
