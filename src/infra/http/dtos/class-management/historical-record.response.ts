import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { EnrollmentResponse } from "./enrollment.response";
import { SchoolYearEnrollmentSummaryResponse } from "./school-year-enrollment-summary.response";

export class HistoricalRecordEnvelopeResponse {
  @Expose()
  @ApiProperty({ enum: ["ENROLLMENT", "SCHOOL_YEAR_ENROLLMENT"] })
  recordType: "ENROLLMENT" | "SCHOOL_YEAR_ENROLLMENT";

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  studentId: string;

  @Expose()
  @ApiProperty()
  finalized: boolean;

  @Expose()
  @Type(() => EnrollmentResponse)
  @ApiProperty({ type: EnrollmentResponse, required: false })
  enrollment?: EnrollmentResponse;

  @Expose()
  @Type(() => SchoolYearEnrollmentSummaryResponse)
  @ApiProperty({ type: SchoolYearEnrollmentSummaryResponse, required: false })
  schoolYearEnrollment?: SchoolYearEnrollmentSummaryResponse;
}

export class DeleteHistoricalRecordResponse {
  @Expose()
  @ApiProperty({ example: true })
  deleted: boolean;

  @Expose()
  @ApiProperty({ enum: ["ENROLLMENT", "SCHOOL_YEAR_ENROLLMENT"] })
  recordType: "ENROLLMENT" | "SCHOOL_YEAR_ENROLLMENT";

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  recordId: string;
}
