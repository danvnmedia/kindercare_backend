import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { StandardRequestParam } from "@/core/modules/standard-response/decorators/standard-request-param.decorator";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { GetSchoolYearStudentsUseCase } from "@/application/class-management/use-cases/school-year-enrollment/get-school-year-students.use-case";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CAMPUS_ID_HEADER,
  CampusContext,
  RequireCampusAccess,
} from "../../decorators";
import {
  GetSchoolYearStudentsQuery,
  SchoolYearStudentResponse,
  SchoolYearStudentSegmentValues,
} from "../../dtos/class-management";

const SCHOOL_YEAR_STUDENTS_ALLOWED_SORT_FIELDS = [
  "enrollmentDate",
  "exitDate",
  "createdAt",
];

const SCHOOL_YEAR_STUDENTS_ALLOWED_FILTER_FIELDS = [
  "studentId",
  "gradeLevelId",
  "enrollmentDate",
  "exitDate",
  "exitReason",
];

@Controller("school-years")
@ApiTags("School Years")
@UseGuards(ClerkAuthGuard)
export class SchoolYearStudentController {
  constructor(
    private readonly getSchoolYearStudentsUseCase: GetSchoolYearStudentsUseCase,
  ) {}

  @Get(":schoolYearId/students")
  @RequireCampusAccess()
  @StandardResponse({
    message: "School year students retrieved successfully",
    type: SchoolYearStudentResponse,
    isPaginated: true,
    allowedSortFields: SCHOOL_YEAR_STUDENTS_ALLOWED_SORT_FIELDS,
    allowedFilterFields: SCHOOL_YEAR_STUDENTS_ALLOWED_FILTER_FIELDS,
  })
  @ApiOperation({
    summary: "Get students registered for a school year",
    description:
      "Returns school-year registration rows with class assignment summary, snapshot labels, fallback metadata, and pagination. Attendance records are not included.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to scope the school-year student list",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "schoolYearId",
    description: "School Year UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "segment",
    enum: SchoolYearStudentSegmentValues,
    required: false,
    description:
      "registered, upcoming, active, unassigned, withdrawn, completed, graduated, or unresolved.",
  })
  @ApiQuery({
    name: "search",
    type: String,
    required: false,
    description:
      "Case-insensitive search over current and snapshot student labels.",
  })
  async getSchoolYearStudents(
    @CampusContext() campusId: string,
    @Param("schoolYearId", ParseUUIDPipe) schoolYearId: string,
    @StandardRequestParam() params: StandardRequest,
    @Query() query: GetSchoolYearStudentsQuery,
  ) {
    return await this.getSchoolYearStudentsUseCase.execute({
      campusId,
      schoolYearId,
      params,
      segment: query.segment,
      search: query.search,
    });
  }
}
