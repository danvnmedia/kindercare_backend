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
  RequireCampusAccess,
} from "../../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";

import {
  StudentEnrollmentHistoryResponse,
  TransferStudentRequest,
  TransferStudentResponse,
} from "../../dtos/class-management";

import { TransferStudentUseCase } from "@/application/class-management/use-cases/enrollment/transfer-student.use-case";
import { GetStudentEnrollmentHistoryUseCase } from "@/application/class-management/use-cases/enrollment/get-student-enrollment-history.use-case";

/**
 * Student Enrollment Controller
 *
 * Hosts the student-keyed enrollment operations that span across classes:
 * transfer and full enrollment history.
 * Lives in the class-management folder for cohesion with the use cases,
 * even though the URL prefix is `/students`.
 */
@Controller("students")
@ApiTags("Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class StudentEnrollmentController {
  constructor(
    private readonly transferStudentUseCase: TransferStudentUseCase,
    private readonly getStudentEnrollmentHistoryUseCase: GetStudentEnrollmentHistoryUseCase,
  ) {}

  @Post(":studentId/transfer")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student transferred successfully",
    type: TransferStudentResponse,
  })
  @ApiOperation({
    summary: "Transfer a student to a different class",
    description:
      "Atomically closes the student's currently-active enrollment (exitReason=TRANSFERRED) and opens a new one in the target class. Both operations run in a single database transaction.",
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
  async transfer(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: TransferStudentRequest,
  ) {
    return await this.transferStudentUseCase.execute({
      studentId,
      campusId,
      toClassId: dto.toClassId,
      transferDate: dto.transferDate ? new Date(dto.transferDate) : undefined,
      fromClassId: dto.fromClassId,
      note: dto.note,
    });
  }

  @Get(":studentId/enrollments")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student enrollment history retrieved successfully",
    type: StudentEnrollmentHistoryResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get a student's full enrollment history",
    description:
      "Returns the student's enrollment rows across all classes (active and closed), ordered by enrollmentDate DESC. Each row includes the class name, school year name, grade level name, endDate, and exitReason.",
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
  async getEnrollmentHistory(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
  ) {
    return await this.getStudentEnrollmentHistoryUseCase.execute({
      studentId,
      campusId,
    });
  }
}
