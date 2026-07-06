import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { CreateOrAttachGuardianResultStatus } from "@/application/user-management/use-cases/guardian/create-or-attach-guardian.use-case";
import { GuardianResponse } from "./guardian.response";

export class CreateOrAttachGuardianResponse {
  @Expose()
  @ApiProperty({
    enum: CreateOrAttachGuardianResultStatus,
    example: CreateOrAttachGuardianResultStatus.ATTACHED_EXISTING_ACCOUNT,
  })
  resultStatus: CreateOrAttachGuardianResultStatus;

  @Expose()
  @Type(() => GuardianResponse)
  @ApiProperty({ type: GuardianResponse })
  guardian: GuardianResponse;
}
