import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";

import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";

export class AssignStaffRequest {
  @ApiProperty({
    description: "Staff ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  staffId: string;

  @ApiProperty({
    enum: ClassStaffRole,
    description:
      "Role assigned to the staff in this class (HOMEROOM / ASSISTANT / BOARDING). HOMEROOM is at most one per class.",
    example: ClassStaffRole.HOMEROOM,
  })
  @IsNotEmpty()
  @IsEnum(ClassStaffRole)
  role: ClassStaffRole;
}
