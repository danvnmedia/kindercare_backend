import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { SchoolYearStudentSegment } from "@/application/class-management/ports/school-year-enrollment.repository";
import {
  SchoolYearStudentSegmentEnum,
  SchoolYearStudentSegmentValues,
} from "./school-year-student-segment";

export class GetSchoolYearStudentsQuery extends StandardRequestDto {
  @IsOptional()
  @IsEnum(SchoolYearStudentSegmentEnum)
  @ApiPropertyOptional({
    enum: SchoolYearStudentSegmentValues,
    default: "registered",
    description:
      "Year-scoped segment. `upcoming` is date-effective; `completed` and `graduated` are intentionally distinct.",
  })
  segment?: SchoolYearStudentSegment;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    description:
      "Case-insensitive search over current and snapshot student labels.",
  })
  search?: string;
}
