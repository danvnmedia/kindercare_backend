import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { EnrollmentResponse } from "./enrollment.response";

export class TransferStudentResponse {
  @Expose()
  @Type(() => EnrollmentResponse)
  @ApiProperty({
    type: EnrollmentResponse,
    description:
      "The previously-active enrollment, now closed with exitReason=TRANSFERRED",
  })
  closed: EnrollmentResponse;

  @Expose()
  @Type(() => EnrollmentResponse)
  @ApiProperty({
    type: EnrollmentResponse,
    description:
      "The newly-opened enrollment in the target class (endDate=null)",
  })
  opened: EnrollmentResponse;
}
