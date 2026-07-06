import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { CreateOrAttachStaffResultStatus } from "@/application/user-management/use-cases/staff/create-or-attach-staff.use-case";
import { StaffResponse } from "./staff.response";

export class CreateOrAttachStaffResponse {
  @Expose()
  @ApiProperty({
    enum: CreateOrAttachStaffResultStatus,
    example: CreateOrAttachStaffResultStatus.ATTACHED_EXISTING_IDENTITY,
  })
  resultStatus: CreateOrAttachStaffResultStatus;

  @Expose()
  @Type(() => StaffResponse)
  @ApiProperty({ type: StaffResponse })
  staff: StaffResponse;
}
