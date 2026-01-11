import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from "@nestjs/swagger";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";

import {
  RecordAttendanceRequest,
  UpdateAttendanceRequest,
  BulkRecordAttendanceRequest,
  StudentAttendanceResponse,
  BulkRecordAttendanceResponse,
} from "../dtos/attendance";

// Use Cases
import { RecordAttendanceUseCase } from "@/application/attendance/use-cases/record-attendance.use-case";
import { UpdateAttendanceUseCase } from "@/application/attendance/use-cases/update-attendance.use-case";
import { GetAttendanceByIdUseCase } from "@/application/attendance/use-cases/get-attendance-by-id.use-case";
import { GetClassAttendanceUseCase } from "@/application/attendance/use-cases/get-class-attendance.use-case";
import { GetStudentAttendanceUseCase } from "@/application/attendance/use-cases/get-student-attendance.use-case";
import { BulkRecordAttendanceUseCase } from "@/application/attendance/use-cases/bulk-record-attendance.use-case";

@Controller("attendance")
@ApiTags("Attendance")
export class AttendanceController {
  constructor(
    private readonly recordAttendanceUseCase: RecordAttendanceUseCase,
    private readonly updateAttendanceUseCase: UpdateAttendanceUseCase,
    private readonly getAttendanceByIdUseCase: GetAttendanceByIdUseCase,
    private readonly getClassAttendanceUseCase: GetClassAttendanceUseCase,
    private readonly getStudentAttendanceUseCase: GetStudentAttendanceUseCase,
    private readonly bulkRecordAttendanceUseCase: BulkRecordAttendanceUseCase,
  ) {}

  @Post()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Attendance recorded successfully",
    type: StudentAttendanceResponse,
  })
  @ApiOperation({
    summary: "Record student attendance",
    description:
      "Record attendance for a student on a specific date. One record per student per date.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async recordAttendance(
    @CampusContext() campusId: string,
    @Body() dto: RecordAttendanceRequest,
  ) {
    return await this.recordAttendanceUseCase.execute({
      campusId,
      studentId: dto.studentId,
      classId: dto.classId,
      date: new Date(dto.date),
      status: dto.status,
      checkinAt: dto.checkinAt ? new Date(dto.checkinAt) : undefined,
      reason: dto.reason,
      note: dto.note,
    });
  }

  @Post("bulk")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Bulk attendance recorded successfully",
    type: BulkRecordAttendanceResponse,
  })
  @ApiOperation({
    summary: "Bulk record attendance",
    description:
      "Record attendance for multiple students in a class on a specific date.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async bulkRecordAttendance(
    @CampusContext() campusId: string,
    @Body() dto: BulkRecordAttendanceRequest,
  ) {
    return await this.bulkRecordAttendanceUseCase.execute({
      campusId,
      classId: dto.classId,
      date: new Date(dto.date),
      records: dto.records.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        checkinAt: r.checkinAt ? new Date(r.checkinAt) : undefined,
        reason: r.reason,
        note: r.note,
      })),
    });
  }

  @Get(":id")
  @StandardResponse({
    message: "Attendance retrieved successfully",
    type: StudentAttendanceResponse,
  })
  @ApiOperation({
    summary: "Get attendance by ID",
    description:
      "Retrieve a single attendance record by its unique identifier.",
  })
  @ApiParam({
    name: "id",
    description: "Attendance record UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getById(@Param("id") id: string) {
    return await this.getAttendanceByIdUseCase.execute(id);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Attendance updated successfully",
    type: StudentAttendanceResponse,
  })
  @ApiOperation({
    summary: "Update attendance",
    description:
      "Update attendance status, check-in/out times, reason, or notes.",
  })
  @ApiParam({
    name: "id",
    description: "Attendance record UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async updateAttendance(
    @Param("id") id: string,
    @Body() dto: UpdateAttendanceRequest,
  ) {
    return await this.updateAttendanceUseCase.execute({
      attendanceId: id,
      checkinAt:
        dto.checkinAt === null
          ? null
          : dto.checkinAt
            ? new Date(dto.checkinAt)
            : undefined,
      checkoutAt:
        dto.checkoutAt === null
          ? null
          : dto.checkoutAt
            ? new Date(dto.checkoutAt)
            : undefined,
      status: dto.status,
      reason: dto.reason,
      note: dto.note,
    });
  }

  @Get("class/:classId")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Class attendance retrieved successfully",
    type: StudentAttendanceResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get class attendance for a date",
    description: "Get all attendance records for a class on a specific date.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "classId",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "date",
    description: "Attendance date",
    example: "2024-09-01",
    required: true,
  })
  async getClassAttendance(
    @CampusContext() campusId: string,
    @Param("classId") classId: string,
    @Query("date") date: string,
  ) {
    return await this.getClassAttendanceUseCase.execute({
      campusId,
      classId,
      date: new Date(date),
    });
  }

  @Get("student/:studentId")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student attendance retrieved successfully",
    type: StudentAttendanceResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get student attendance history",
    description: "Get attendance records for a student within a date range.",
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
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "startDate",
    description: "Start date of the range",
    example: "2024-09-01",
    required: true,
  })
  @ApiQuery({
    name: "endDate",
    description: "End date of the range",
    example: "2024-09-30",
    required: true,
  })
  async getStudentAttendance(
    @CampusContext() campusId: string,
    @Param("studentId") studentId: string,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    return await this.getStudentAttendanceUseCase.execute({
      campusId,
      studentId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }
}
