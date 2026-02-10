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
  ApiQuery,
  ApiHeader,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

import {
  CreateClassRequest,
  UpdateClassRequest,
  ClassResponse,
  EnrollStudentRequest,
  EnrollmentResponse,
  AssignStaffRequest,
  ClassStaffResponse,
} from "../../dtos/class-management";

// Use Cases
import { CreateClassUseCase } from "@/application/class-management/use-cases/class/create-class.use-case";
import { GetClassByIdUseCase } from "@/application/class-management/use-cases/class/get-class-by-id.use-case";
import { GetAllClassesUseCase } from "@/application/class-management/use-cases/class/get-all-classes.use-case";
import { UpdateClassUseCase } from "@/application/class-management/use-cases/class/update-class.use-case";
import { DeleteClassUseCase } from "@/application/class-management/use-cases/class/delete-class.use-case";
import { EnrollStudentUseCase } from "@/application/class-management/use-cases/enrollment/enroll-student.use-case";
import { GetClassEnrollmentsUseCase } from "@/application/class-management/use-cases/enrollment/get-class-enrollments.use-case";
import { UnenrollStudentUseCase } from "@/application/class-management/use-cases/enrollment/unenroll-student.use-case";
import { AssignStaffToClassUseCase } from "@/application/class-management/use-cases/class-staff/assign-staff-to-class.use-case";
import { GetClassStaffUseCase } from "@/application/class-management/use-cases/class-staff/get-class-staff.use-case";
import { RemoveStaffFromClassUseCase } from "@/application/class-management/use-cases/class-staff/remove-staff-from-class.use-case";

@Controller("classes")
@ApiTags("Classes")
@UseGuards(ClerkAuthGuard)
export class ClassController {
  constructor(
    private readonly createClassUseCase: CreateClassUseCase,
    private readonly getClassByIdUseCase: GetClassByIdUseCase,
    private readonly getAllClassesUseCase: GetAllClassesUseCase,
    private readonly updateClassUseCase: UpdateClassUseCase,
    private readonly deleteClassUseCase: DeleteClassUseCase,
    private readonly enrollStudentUseCase: EnrollStudentUseCase,
    private readonly getClassEnrollmentsUseCase: GetClassEnrollmentsUseCase,
    private readonly unenrollStudentUseCase: UnenrollStudentUseCase,
    private readonly assignStaffToClassUseCase: AssignStaffToClassUseCase,
    private readonly getClassStaffUseCase: GetClassStaffUseCase,
    private readonly removeStaffFromClassUseCase: RemoveStaffFromClassUseCase,
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
    type: ClassResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all classes",
    description:
      "Retrieve all classes with advanced filtering, sorting, and pagination. Supports filtering by name, description, gradeLevelId, schoolYearId.",
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
  ) {
    return await this.enrollStudentUseCase.execute({
      campusId,
      classId,
      studentId: dto.studentId,
      enrollmentDate: new Date(dto.enrollmentDate),
      note: dto.note,
    });
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
    description: "Get all students enrolled in this class.",
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
  async getEnrollments(
    @CampusContext() campusId: string,
    @Param("id") classId: string,
  ) {
    return await this.getClassEnrollmentsUseCase.execute(classId, campusId);
  }

  @Delete(":classId/enrollments/:enrollmentId")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student unenrolled successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Unenroll student from class",
    description: "Remove a student's enrollment from this class.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the unenrollment",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "classId",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "enrollmentId",
    description: "Enrollment UUID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  async unenrollStudent(
    @CampusContext() campusId: string,
    @Param("enrollmentId") enrollmentId: string,
  ) {
    await this.unenrollStudentUseCase.execute(enrollmentId, campusId);
    return null;
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
      "Assign a staff member to teach a specific subject in this class.",
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
  ) {
    return await this.assignStaffToClassUseCase.execute({
      campusId,
      classId,
      staffId: dto.staffId,
      subjectId: dto.subjectId,
    });
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

  @Delete(":classId/staff/:staffId/subjects/:subjectId")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff removed from class successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Remove staff from class",
    description:
      "Remove a staff member's assignment from this class for a specific subject.",
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
  @ApiParam({
    name: "subjectId",
    description: "Subject UUID",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  async removeStaff(
    @CampusContext() campusId: string,
    @Param("classId") classId: string,
    @Param("staffId") staffId: string,
    @Param("subjectId") subjectId: string,
  ) {
    await this.removeStaffFromClassUseCase.execute({
      classId,
      staffId,
      subjectId,
    });
    return null;
  }
}
