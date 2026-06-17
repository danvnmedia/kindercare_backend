import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty } from "class-validator";

import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";

export class ChangeClassStaffRoleRequest {
  @ApiProperty({
    enum: ClassStaffRole,
    description:
      "New role for the staff in this class. Same value as the current role is treated as a no-op (200 with the existing row, no audit event).",
    example: ClassStaffRole.HOMEROOM,
  })
  @IsNotEmpty()
  @IsEnum(ClassStaffRole)
  role: ClassStaffRole;
}
