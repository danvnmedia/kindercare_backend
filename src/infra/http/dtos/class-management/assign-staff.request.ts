import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class AssignStaffRequest {
  @ApiProperty({
    description: "Staff ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  staffId: string;

  @ApiProperty({
    description: "Subject ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsNotEmpty()
  @IsUUID()
  subjectId: string;
}
