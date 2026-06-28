import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { User } from "@/domain/user-management/user.entity";

import {
  RegisterForSchoolYearRequest,
  SchoolYearEnrollmentResponse,
  SchoolYearEnrollmentSummaryResponse,
} from "../../dtos/class-management";

import { RegisterForSchoolYearUseCase } from "@/application/class-management/use-cases/school-year-enrollment/register-for-school-year.use-case";
import { GetStudentSchoolYearHistoryUseCase } from "@/application/class-management/use-cases/school-year-enrollment/get-student-school-year-history.use-case";

/**
 * SchoolYearEnrollment Controller
 *
 * Hosts the student-keyed parent-enrollment operations defined by
 * specs/school-year-enrollment-model. Mounted at /students. The withdraw
 * cascade route lives separately on `SchoolYearEnrollmentLifecycleController`
 * because it uses the `/school-year-enrollments` URL prefix.
 */
@Controller("students")
@ApiTags("Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class SchoolYearEnrollmentController {
  constructor(
    private readonly registerForSchoolYearUseCase: RegisterForSchoolYearUseCase,
    private readonly getStudentSchoolYearHistoryUseCase: GetStudentSchoolYearHistoryUseCase,
  ) {}

  @Post(":studentId/school-year-enrollments")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student registered for school year",
    type: SchoolYearEnrollmentResponse,
  })
  @ApiOperation({
    summary: "Register a student for a school year",
    description:
      "Creates the parent enrollment row anchoring this student to a school year + grade level. Required before any class enrollment can be created for the same student in that school year (specs/school-year-enrollment-model D1).",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  async register(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: RegisterForSchoolYearRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.registerForSchoolYearUseCase.execute(
      {
        campusId,
        studentId,
        schoolYearId: dto.schoolYearId,
        gradeLevelId: dto.gradeLevelId,
        enrollmentDate: new Date(dto.enrollmentDate),
        note: dto.note,
      },
      currentUser,
    );
  }

  @Get(":studentId/school-year-enrollments")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student school year enrollment history retrieved successfully",
    type: SchoolYearEnrollmentSummaryResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get a student's full school-year enrollment history",
    description:
      "Returns one row per parent SchoolYearEnrollment for the student, ordered by enrollmentDate DESC. Each row embeds the school year (name + dates), grade level (name + order), and the number of child class-level enrollments captured under that parent (specs/school-year-enrollment-model AC-23).",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  async getHistory(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
  ) {
    return await this.getStudentSchoolYearHistoryUseCase.execute({
      studentId,
      campusId,
    });
  }
}
