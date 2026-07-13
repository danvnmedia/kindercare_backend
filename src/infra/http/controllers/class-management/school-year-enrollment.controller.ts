import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  CorrectSchoolYearEnrollmentGradeRequest,
  RegisterForSchoolYearRequest,
  SchoolYearEnrollmentResponse,
  SchoolYearEnrollmentSummaryResponse,
} from "../../dtos/class-management";

import { RegisterForSchoolYearUseCase } from "@/application/class-management/use-cases/school-year-enrollment/register-for-school-year.use-case";
import { GetStudentSchoolYearHistoryUseCase } from "@/application/class-management/use-cases/school-year-enrollment/get-student-school-year-history.use-case";
import { CorrectSchoolYearEnrollmentGradeUseCase } from "@/application/class-management/use-cases/school-year-enrollment/correct-school-year-enrollment-grade.use-case";
import { parseDateOnly } from "@/application/class-management/date-only";

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
    private readonly correctSchoolYearEnrollmentGradeUseCase: CorrectSchoolYearEnrollmentGradeUseCase,
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
        enrollmentDate: parseDateOnly(dto.enrollmentDate),
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
      "Returns one row per parent SchoolYearEnrollment for the student, ordered by enrollmentDate DESC, with authoritative effective status, cancellation facts/actor summary, school year, grade level, and the count of uncancelled child class-level enrollments.",
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

  @Patch(":studentId/school-year-enrollments/:schoolYearEnrollmentId/grade")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student school year enrollment grade corrected",
    type: SchoolYearEnrollmentResponse,
  })
  @ApiOperation({
    summary: "Correct a school-year enrollment grade before class placement",
    description:
      "Updates the parent SchoolYearEnrollment gradeLevelId only while no child class-level enrollments exist. Once a class enrollment exists, the endpoint returns a stable correction-not-allowed code/action contract.",
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
  @ApiParam({
    name: "schoolYearEnrollmentId",
    description: "SchoolYearEnrollment UUID",
    type: "string",
    format: "uuid",
  })
  async correctGrade(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("schoolYearEnrollmentId", ParseUUIDPipe)
    schoolYearEnrollmentId: string,
    @Body() dto: CorrectSchoolYearEnrollmentGradeRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.correctSchoolYearEnrollmentGradeUseCase.execute(
      {
        id: schoolYearEnrollmentId,
        studentId,
        campusId,
        gradeLevelId: dto.gradeLevelId,
      },
      currentUser,
    );
  }
}
