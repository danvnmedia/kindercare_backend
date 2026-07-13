import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiHeader,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";
import { User } from "@/domain/user-management/user.entity";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { StandardRequestParam } from "@/core/modules/standard-response/decorators/standard-request-param.decorator";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";

import {
  CreateClassRequest,
  UpdateClassRequest,
  ClassResponse,
  ClassListItemResponse,
  EnrollStudentRequest,
  WithdrawStudentRequest,
  EnrollmentResponse,
  BulkEnrollStudentsRequest,
  BulkEnrollStudentsResponse,
  BulkTransferStudentsRequest,
  BulkTransferStudentsResponse,
  EnrollmentReadinessRequest,
  EnrollmentReadinessResponse,
  AssignStaffRequest,
  BulkAssignStaffRequest,
  BulkAssignStaffResponse,
  ChangeClassStaffRoleRequest,
  ClassStaffResponse,
  GetClassEnrollmentsQuery,
  EligibleStudentsQuery,
  EligibleStaffQuery,
} from "../../dtos/class-management";
import { StudentResponse } from "../../dtos/user-management/student";
import { StaffResponse } from "../../dtos/user-management/staff/staff.response";

// Use Cases
import { CreateClassUseCase } from "@/application/class-management/use-cases/class/create-class.use-case";
import { GetClassByIdUseCase } from "@/application/class-management/use-cases/class/get-class-by-id.use-case";
import { GetAllClassesUseCase } from "@/application/class-management/use-cases/class/get-all-classes.use-case";
import { UpdateClassUseCase } from "@/application/class-management/use-cases/class/update-class.use-case";
import { DeleteClassUseCase } from "@/application/class-management/use-cases/class/delete-class.use-case";
import { EnrollStudentUseCase } from "@/application/class-management/use-cases/enrollment/enroll-student.use-case";
import { WithdrawStudentUseCase } from "@/application/class-management/use-cases/enrollment/withdraw-student.use-case";
import { BulkEnrollStudentsUseCase } from "@/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case";
import { BulkTransferStudentsUseCase } from "@/application/class-management/use-cases/enrollment/bulk-transfer-students.use-case";
import { GetEnrollmentReadinessUseCase } from "@/application/class-management/use-cases/enrollment/get-enrollment-readiness.use-case";
import { GetClassEnrollmentsUseCase } from "@/application/class-management/use-cases/enrollment/get-class-enrollments.use-case";
import { GetEligibleStudentsForClassUseCase } from "@/application/user-management/use-cases/student/get-eligible-students-for-class.use-case";
import { GetEligibleStaffForClassUseCase } from "@/application/user-management/use-cases/staff/get-eligible-staff-for-class.use-case";
import { AssignStaffToClassUseCase } from "@/application/class-management/use-cases/class-staff/assign-staff-to-class.use-case";
import { BulkAssignStaffToClassUseCase } from "@/application/class-management/use-cases/class-staff/bulk-assign-staff-to-class.use-case";
import { GetClassStaffUseCase } from "@/application/class-management/use-cases/class-staff/get-class-staff.use-case";
import { RemoveStaffFromClassUseCase } from "@/application/class-management/use-cases/class-staff/remove-staff-from-class.use-case";
import { ChangeClassStaffRoleUseCase } from "@/application/class-management/use-cases/class-staff/change-class-staff-role.use-case";
import { parseDateOnly } from "@/application/class-management/date-only";

@Controller("classes")
@ApiTags("Classes")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class ClassController {
  constructor(
    private readonly createClassUseCase: CreateClassUseCase,
    private readonly getClassByIdUseCase: GetClassByIdUseCase,
    private readonly getAllClassesUseCase: GetAllClassesUseCase,
    private readonly updateClassUseCase: UpdateClassUseCase,
    private readonly deleteClassUseCase: DeleteClassUseCase,
    private readonly enrollStudentUseCase: EnrollStudentUseCase,
    private readonly bulkEnrollStudentsUseCase: BulkEnrollStudentsUseCase,
    private readonly bulkTransferStudentsUseCase: BulkTransferStudentsUseCase,
    private readonly getEnrollmentReadinessUseCase: GetEnrollmentReadinessUseCase,
    private readonly withdrawStudentUseCase: WithdrawStudentUseCase,
    private readonly getClassEnrollmentsUseCase: GetClassEnrollmentsUseCase,
    private readonly getEligibleStudentsForClassUseCase: GetEligibleStudentsForClassUseCase,
    private readonly getEligibleStaffForClassUseCase: GetEligibleStaffForClassUseCase,
    private readonly assignStaffToClassUseCase: AssignStaffToClassUseCase,
    private readonly bulkAssignStaffToClassUseCase: BulkAssignStaffToClassUseCase,
    private readonly getClassStaffUseCase: GetClassStaffUseCase,
    private readonly removeStaffFromClassUseCase: RemoveStaffFromClassUseCase,
    private readonly changeClassStaffRoleUseCase: ChangeClassStaffRoleUseCase,
  ) {}

  @Post()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Class created successfully",
    type: ClassResponse,
  })
  @ApiOperation({
    summary: "Create a new class",
    description:
      "Creates a new class for a specific grade level and school year.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the class creation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateClassRequest,
  ) {
    return await this.createClassUseCase.execute({
      ...dto,
      campusId,
    });
  }

  @Get()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Classes retrieved successfully",
    type: ClassListItemResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all classes",
    description:
      "Retrieve all classes with advanced filtering, sorting, and pagination. Supports filtering by name, description, gradeLevelId, schoolYearId. Each row carries authoritative `activeStudentCount`, `upcomingStudentCount`, and closed-only `historicalStudentCount` projections plus a compact `staff[]` preview. Cancelled rows contribute to none of the counts.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID to filter classes",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findAll(
    @CampusContext() campusId: string,
    @Query() query: StandardRequestDto,
  ) {
    return await this.getAllClassesUseCase.execute({
      campusId,
      params: query,
    });
  }

  @Get(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Class retrieved successfully",
    type: ClassResponse,
  })
  @ApiOperation({
    summary: "Get class by ID",
    description: "Retrieve a single class by its unique identifier.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the class retrieval",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findById(@CampusContext() campusId: string, @Param("id") id: string) {
    return await this.getClassByIdUseCase.execute(id, campusId);
  }

  @Patch(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Class updated successfully",
    type: ClassResponse,
  })
  @ApiOperation({
    summary: "Update class",
    description: "Update class name, description, or grade level.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the class update",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdateClassRequest,
  ) {
    return await this.updateClassUseCase.execute(id, dto);
  }

  @Delete(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Class deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete class",
    description:
      "Delete a class. This will also remove all enrollments and staff assignments.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the class deletion",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async delete(@CampusContext() campusId: string, @Param("id") id: string) {
    await this.deleteClassUseCase.execute(id, campusId);
    return null;
  }

  // ==================== Enrollment Endpoints ====================

  @Post(":id/enrollments/readiness")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Enrollment readiness evaluated",
    type: EnrollmentReadinessResponse,
  })
  @ApiOperation({
    summary: "Preview class enrollment readiness",
    description:
      "Read-only readiness check for class enrollment or transfer. Returns one typed row per student and performs no writes.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Target class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getEnrollmentReadiness(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
    @Body() dto: EnrollmentReadinessRequest,
  ) {
    const effectiveDate = parseDateOnly(dto.effectiveDate);
    const rows = await this.getEnrollmentReadinessUseCase.execute({
      campusId,
      classId,
      mode: dto.mode,
      effectiveDate,
      students: dto.students.map((row) => ({
        studentId: row.studentId,
        fromClassId: row.fromClassId,
      })),
    });

    return {
      mode: dto.mode,
      effectiveDate,
      rows,
    };
  }

  @Post(":id/enrollments")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student enrolled successfully",
    type: EnrollmentResponse,
  })
  @ApiOperation({
    summary: "Enroll a student in class",
    description:
      "Enroll a student in this class with the specified enrollment date.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async enrollStudent(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
    @Body() dto: EnrollStudentRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.enrollStudentUseCase.execute(
      {
        campusId,
        classId,
        studentId: dto.studentId,
        enrollmentDate: parseDateOnly(dto.enrollmentDate),
        note: dto.note,
      },
      currentUser,
    );
  }

  @Post(":id/enrollments/bulk")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Bulk enroll completed",
    type: BulkEnrollStudentsResponse,
  })
  @ApiOperation({
    summary: "Bulk enroll students into a class",
    description:
      "Enrolls up to 100 students into a class in a single call. Whole-call validation (BATCH_EMPTY, BATCH_TOO_LARGE, DUPLICATE_STUDENT_IN_BATCH, class+campus, schoolYear bounds) short-circuits with 4xx and zero row work. Per-row validation is tolerant: failing rows appear in `skipped[]` with a stable machine `reason` and the rest persist atomically inside one transaction.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async bulkEnrollStudents(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
    @Body() dto: BulkEnrollStudentsRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.bulkEnrollStudentsUseCase.execute(
      {
        campusId,
        classId,
        enrollmentDate: parseDateOnly(dto.enrollmentDate),
        note: dto.note,
        students: dto.students.map((row) => ({
          studentId: row.studentId,
          note: row.note,
        })),
      },
      currentUser,
    );
  }

  @Post(":id/transfers/bulk")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Bulk transfer completed",
    type: BulkTransferStudentsResponse,
  })
  @ApiOperation({
    summary: "Bulk transfer students into a class",
    description:
      "Transfers up to 100 students into a target class in a single call. Whole-call validation (BATCH_EMPTY, BATCH_TOO_LARGE, DUPLICATE_STUDENT_IN_BATCH, target class+campus, transferDate within target schoolYear) short-circuits with 4xx and zero row work. Per-row validation (NO_ACTIVE_ENROLLMENT, TRANSFER_SOURCE_MISMATCH, TRANSFER_SAME_CLASS) is tolerant: failing rows appear in `skipped[]` and the rest persist. Each survivor's close+open pair runs in its own DB transaction, so a row-level DB error rolls back only that row.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description:
      "Target class UUID (the class students are being transferred into)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async bulkTransferStudents(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
    @Body() dto: BulkTransferStudentsRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.bulkTransferStudentsUseCase.execute(
      {
        campusId,
        classId,
        transferDate: parseDateOnly(dto.transferDate),
        note: dto.note,
        students: dto.students.map((row) => ({
          studentId: row.studentId,
          fromClassId: row.fromClassId,
          note: row.note,
        })),
      },
      currentUser,
    );
  }

  @Post(":id/enrollments/:enrollmentId/withdraw")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student withdrawn successfully",
    type: EnrollmentResponse,
  })
  @ApiOperation({
    summary: "Withdraw a student from class",
    description:
      "Closes the enrollment period for the given enrollmentId. Defaults to today if endDate is omitted. A second withdraw on the same row returns 409 ENROLLMENT_ALREADY_CLOSED.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "enrollmentId",
    description: "Enrollment UUID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  async withdrawStudent(
    @CampusContext() campusId: string,
    @Param("id") _classId: string,
    @Param("enrollmentId") enrollmentId: string,
    @Body() dto: WithdrawStudentRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.withdrawStudentUseCase.execute(
      {
        enrollmentId,
        campusId,
        reason: dto.reason,
        endDate: dto.endDate ? parseDateOnly(dto.endDate) : undefined,
        note: dto.note,
      },
      currentUser,
    );
  }

  @Get(":id/enrollments")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Enrollments retrieved successfully",
    type: EnrollmentResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get class enrollments",
    description:
      "Get class enrollment periods by authoritative status at the current UTC date. Omission defaults to ACTIVE. Use ALL to return active, upcoming, closed, and cancelled rows.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the enrollment retrieval",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "effectiveStatus",
    required: false,
    enum: ["ACTIVE", "UPCOMING", "CLOSED", "CANCELLED", "ALL"],
    description:
      "Authoritative UTC status filter. Defaults to ACTIVE when omitted.",
  })
  async getEnrollments(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
    @Query() query: GetClassEnrollmentsQuery,
  ) {
    return await this.getClassEnrollmentsUseCase.execute({
      classId,
      campusId,
      effectiveStatus: query.effectiveStatus,
    });
  }

  @Get(":classId/eligible-students")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Eligible students retrieved successfully",
    type: StudentResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get students eligible to be enrolled into this class",
    description:
      "Returns paginated students at the same campus as the class who are not archived and have no currently open enrollment in any class. Phase narrowing is a client-side concern. Cross-campus class lookups return 404.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the eligibility check",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "classId",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Case-insensitive substring match on fullName",
  })
  async getEligibleStudents(
    @CampusContext() campusId: string,
    @Param("classId") classId: string,
    @StandardRequestParam() params: StandardRequest,
    @Query() query: EligibleStudentsQuery,
  ) {
    return await this.getEligibleStudentsForClassUseCase.execute({
      classId,
      campusId,
      params,
      search: query.search,
    });
  }

  @Get(":classId/eligible-staff")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Eligible staff retrieved successfully",
    type: StaffResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get staff eligible to be assigned to this class",
    description:
      "Returns paginated staff at the same campus as the class who are not archived and have no existing classStaff row for this class (anti-join, regardless of role). Cross-campus class lookups return 404.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the eligibility check",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "classId",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Case-insensitive substring match on fullName",
  })
  async getEligibleStaff(
    @CampusContext() campusId: string,
    @Param("classId") classId: string,
    @StandardRequestParam() params: StandardRequest,
    @Query() query: EligibleStaffQuery,
  ) {
    return await this.getEligibleStaffForClassUseCase.execute({
      classId,
      campusId,
      params,
      search: query.search,
    });
  }

  // ==================== Staff Assignment Endpoints ====================

  @Post(":id/staff")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff assigned successfully",
    type: ClassStaffResponse,
  })
  @ApiOperation({
    summary: "Assign a staff member to class",
    description:
      "Assign a staff member to a class with a role (HOMEROOM / ASSISTANT / BOARDING). HOMEROOM is at most one per class. Emits an ASSIGN_STAFF_TO_CLASS audit event.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async assignStaff(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
    @Body() dto: AssignStaffRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.assignStaffToClassUseCase.execute(
      {
        campusId,
        classId,
        staffId: dto.staffId,
        role: dto.role,
      },
      currentUser,
    );
  }

  @Post(":id/staff/bulk")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Bulk assign staff completed",
    type: BulkAssignStaffResponse,
  })
  @ApiOperation({
    summary: "Bulk assign staff to a class",
    description:
      "Assigns up to 100 staff members to a class in a single call. Each row carries its own role (HOMEROOM / ASSISTANT / BOARDING) — there is no batch-level role. Whole-call validation (BATCH_EMPTY, BATCH_TOO_LARGE, DUPLICATE_STAFF_IN_BATCH, MULTIPLE_HOMEROOM_IN_BATCH, class+campus) short-circuits with 4xx and zero row work. Per-row validation (STAFF_NOT_FOUND, STAFF_NOT_IN_CAMPUS, STAFF_ALREADY_ASSIGNED, HOMEROOM_ALREADY_ASSIGNED) is tolerant: failing rows appear in `skipped[]` with a stable machine `reason` and the rest persist atomically inside one transaction with their ASSIGN_STAFF_TO_CLASS audit events.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus ID for the operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async bulkAssignStaff(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
    @Body() dto: BulkAssignStaffRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.bulkAssignStaffToClassUseCase.execute(
      {
        campusId,
        classId,
        staff: dto.staff.map((row) => ({
          staffId: row.staffId,
          role: row.role,
        })),
      },
      currentUser,
    );
  }

  @Get(":id/staff")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Class staff retrieved successfully",
    type: ClassStaffResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get class staff",
    description: "Get all staff members assigned to this class.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff retrieval",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getStaff(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
  ) {
    return await this.getClassStaffUseCase.execute(classId, campusId);
  }

  @Delete(":classId/staff/:staffId")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff removed from class successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Remove staff from class",
    description:
      "Remove a staff member's assignment from this class. Emits a REMOVE_STAFF_FROM_CLASS audit event capturing the previous role.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff removal",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "classId",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "staffId",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  async removeStaff(
    @CampusContext() campusId: string,
    @Param("classId") classId: string,
    @Param("staffId") staffId: string,
    @CurrentUser() currentUser: User,
  ) {
    await this.removeStaffFromClassUseCase.execute(
      {
        campusId,
        classId,
        staffId,
      },
      currentUser,
    );
    return null;
  }

  @Patch(":classId/staff/:staffId")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff role updated successfully",
    type: ClassStaffResponse,
  })
  @ApiOperation({
    summary: "Change the role of a staff in a class",
    description:
      "Updates the role assigned to a staff in this class. No-op (same role as current) returns 200 with the existing row and emits no audit event. Promoting to HOMEROOM when another HOMEROOM already exists returns 409 HOMEROOM_ALREADY_ASSIGNED.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the role change",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "classId",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "staffId",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  async changeStaffRole(
    @CampusContext() campusId: string,
    @Param("classId") classId: string,
    @Param("staffId") staffId: string,
    @Body() dto: ChangeClassStaffRoleRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.changeClassStaffRoleUseCase.execute(
      {
        campusId,
        classId,
        staffId,
        newRole: dto.role,
      },
      currentUser,
    );
  }
}
