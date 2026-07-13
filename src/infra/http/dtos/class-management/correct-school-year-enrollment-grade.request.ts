import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class CorrectSchoolYearEnrollmentGradeRequest {
  @ApiProperty({
    description: "Target grade level UUID for this school-year registration",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  gradeLevelId: string;
}
