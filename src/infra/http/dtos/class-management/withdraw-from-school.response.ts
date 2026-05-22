import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { SchoolYearEnrollmentResponse } from "./school-year-enrollment.response";
import { EnrollmentResponse } from "./enrollment.response";

/**
 * Atomic-withdraw response shape (specs/school-year-enrollment-model AC-22).
 * `closedChild` is null when the student had no open class enrollment at
 * the time of withdrawal (Scenario 5).
 */
export class WithdrawFromSchoolResponse {
  @Expose()
  @Type(() => SchoolYearEnrollmentResponse)
  @ApiProperty({
    type: SchoolYearEnrollmentResponse,
    description: "Closed parent SchoolYearEnrollment row.",
  })
  closedParent: SchoolYearEnrollmentResponse;

  @Expose()
  @Type(() => EnrollmentResponse)
  @ApiProperty({
    type: EnrollmentResponse,
    nullable: true,
    description:
      "Closed class-level enrollment, or null if the student had no open class enrollment.",
  })
  closedChild: EnrollmentResponse | null;
}
