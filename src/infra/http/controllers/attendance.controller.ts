import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiHeader,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
  CurrentUser,
} from "../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { User } from "@/domain/user-management/user.entity";

import {
  RecordAttendanceRequest,
  UpdateAttendanceRequest,
  BulkRecordAttendanceRequest,
  StudentAttendanceResponse,
  BulkRecordAttendanceResponse,
  ClassRollCallResponse,
  SaveClassRollCallRequest,
  SaveClassRollCallResponse,
  AttendanceClassOptionsQuery,
  AttendanceClassOptionResponse,
} from "../dtos/attendance";

// Use Cases
import { RecordAttendanceUseCase } from "@/application/attendance/use-cases/record-attendance.use-case";
import { UpdateAttendanceUseCase } from "@/application/attendance/use-cases/update-attendance.use-case";
import { GetAttendanceByIdUseCase } from "@/application/attendance/use-cases/get-attendance-by-id.use-case";
import { GetClassAttendanceUseCase } from "@/application/attendance/use-cases/get-class-attendance.use-case";
import { GetStudentAttendanceUseCase } from "@/application/attendance/use-cases/get-student-attendance.use-case";
import { BulkRecordAttendanceUseCase } from "@/application/attendance/use-cases/bulk-record-attendance.use-case";
import { GetClassRollCallUseCase } from "@/application/attendance/use-cases/get-class-roll-call.use-case";
import { SaveClassRollCallUseCase } from "@/application/attendance/use-cases/save-class-roll-call.use-case";
import { GetAttendanceClassOptionsUseCase } from "@/application/attendance/use-cases/get-attendance-class-options.use-case";
import { Permissions } from "../decorators/permissions.decorator";
import { PermissionsGuard } from "../guards/permissions.guard";

@Controller("attendance")
@ApiTags("Attendance")
@UseGuards(ClerkAuthGuard)
export class AttendanceController {
  constructor(
    private readonly recordAttendanceUseCase: RecordAttendanceUseCase,
    private readonly updateAttendanceUseCase: UpdateAttendanceUseCase,
    private readonly getAttendanceByIdUseCase: GetAttendanceByIdUseCase,
    private readonly getClassAttendanceUseCase: GetClassAttendanceUseCase,
    private readonly getStudentAttendanceUseCase: GetStudentAttendanceUseCase,
    private readonly bulkRecordAttendanceUseCase: BulkRecordAttendanceUseCase,
    private readonly getClassRollCallUseCase: GetClassRollCallUseCase,
    private readonly saveClassRollCallUseCase: SaveClassRollCallUseCase,
    private readonly getAttendanceClassOptionsUseCase: GetAttendanceClassOptionsUseCase,
  ) {}

  @Get("class-options")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("attendance.read", "attendance.list")
  @StandardResponse({
    message: "Attendance class options retrieved successfully",
    type: AttendanceClassOptionResponse,
    isPaginated: true,
    defaultLimit: 25,
    maxLimit: 100,
    allowedSortFields: ["name"],
  })
  @ApiOperation({
    summary: "List class options for attendance roll-call",
    description:
      "Returns a lightweight, searchable, campus-scoped class list for the attendance selector.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getAttendanceClassOptions(
    @CampusContext() campusId: string,
    @Query() query: AttendanceClassOptionsQuery,
  ) {
    return this.getAttendanceClassOptionsUseCase.execute({
      campusId,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

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
  ): Promise<StudentAttendanceResponse> {
    const result = await this.recordAttendanceUseCase.execute({
      campusId,
      studentId: dto.studentId,
      classId: dto.classId,
      date: new Date(dto.date),
      status: dto.status,
      checkinAt: dto.checkinAt ? new Date(dto.checkinAt) : undefined,
      note: dto.note,
      imageFileId: dto.imageFileId,
    });
    return StudentAttendanceResponse.fromDomain(result.summary);
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
  ): Promise<BulkRecordAttendanceResponse> {
    const result = await this.bulkRecordAttendanceUseCase.execute({
      campusId,
      classId: dto.classId,
      date: new Date(dto.date),
      records: dto.records.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        checkinAt: r.checkinAt ? new Date(r.checkinAt) : undefined,
        note: r.note,
        imageFileId: r.imageFileId,
      })),
    });
    return {
      created: result.created.map((item) =>
        StudentAttendanceResponse.fromDomain(item.summary),
      ),
      skipped: result.skipped,
    };
  }

  @Get(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Attendance retrieved successfully",
    type: StudentAttendanceResponse,
  })
  @ApiOperation({
    summary: "Get attendance by ID",
    description:
      "Retrieve a single attendance record by its unique identifier.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the attendance retrieval",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Attendance record UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getById(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ): Promise<StudentAttendanceResponse> {
    const summary = await this.getAttendanceByIdUseCase.execute(id, campusId);
    return StudentAttendanceResponse.fromDomain(summary);
  }

  @Patch(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Attendance updated successfully",
    type: StudentAttendanceResponse,
  })
  @ApiOperation({
    summary: "Update attendance",
    description:
      "Update attendance status, check-in/out times, or notes. New check-in/out times will create log entries.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the attendance update",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Attendance record UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async updateAttendance(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdateAttendanceRequest,
  ): Promise<StudentAttendanceResponse> {
    const result = await this.updateAttendanceUseCase.execute({
      attendanceId: id,
      checkinAt: dto.checkinAt ? new Date(dto.checkinAt) : undefined,
      checkoutAt: dto.checkoutAt ? new Date(dto.checkoutAt) : undefined,
      status: dto.status,
      note: dto.note,
    });
    return StudentAttendanceResponse.fromDomain(result.summary);
  }

  @Get("class/:classId/roll-call")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("attendance.read", "attendance.list")
  @StandardResponse({
    message: "Class roll-call sheet retrieved successfully",
    type: ClassRollCallResponse,
  })
  @ApiOperation({
    summary: "Get class roll-call sheet for a date",
    description:
      "Returns one row per student active in the class on the selected date with saved attendance, approved absence context, and derived V1 roll-call state.",
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
    description: "Roll-call date in YYYY-MM-DD format",
    example: "2026-07-06",
    required: true,
  })
  async getClassRollCall(
    @CampusContext() campusId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Query("date") date: string,
  ): Promise<ClassRollCallResponse> {
    const sheet = await this.getClassRollCallUseCase.execute({
      campusId,
      classId,
      date,
    });
    return ClassRollCallResponse.fromUseCase(sheet);
  }

  @Post("class/:classId/roll-call")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("attendance.create", "attendance.update")
  @StandardResponse({
    message: "Class roll-call sheet saved successfully",
    type: SaveClassRollCallResponse,
  })
  @ApiOperation({
    summary: "Save class roll-call sheet for a date",
    description:
      "Saves teacher or assistant roll-call selections for active students in the class roster. NOT_IDENTIFIED rows are skipped and do not persist attendance.",
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
  async saveClassRollCall(
    @CampusContext() campusId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Body() dto: SaveClassRollCallRequest,
    @CurrentUser() currentUser: User,
  ): Promise<SaveClassRollCallResponse> {
    const result = await this.saveClassRollCallUseCase.execute({
      campusId,
      classId,
      date: dto.date,
      rows: dto.rows,
      currentUser,
    });
    return SaveClassRollCallResponse.fromUseCase(result);
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
  ): Promise<StudentAttendanceResponse[]> {
    const summaries = await this.getClassAttendanceUseCase.execute({
      campusId,
      classId,
      date: new Date(date),
    });
    return summaries.map((s) => StudentAttendanceResponse.fromDomain(s));
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
  ): Promise<StudentAttendanceResponse[]> {
    const summaries = await this.getStudentAttendanceUseCase.execute({
      campusId,
      studentId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    return summaries.map((s) => StudentAttendanceResponse.fromDomain(s));
  }
}
