import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID } from "class-validator";

export class AssignTeacherRequest {
  @ApiProperty({
    description: "Teacher ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  teacherId: string;

  @ApiProperty({
    description: "Subject ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsNotEmpty()
  @IsUUID()
  subjectId: string;
}
