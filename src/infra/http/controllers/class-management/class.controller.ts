import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiParam } from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

import {
  CreateClassRequest,
  UpdateClassRequest,
  ClassResponse,
  EnrollStudentRequest,
  EnrollmentResponse,
  AssignTeacherRequest,
  ClassTeacherResponse,
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
import { AssignTeacherToClassUseCase } from "@/application/class-management/use-cases/class-teacher/assign-teacher-to-class.use-case";
import { GetClassTeachersUseCase } from "@/application/class-management/use-cases/class-teacher/get-class-teachers.use-case";
import { RemoveTeacherFromClassUseCase } from "@/application/class-management/use-cases/class-teacher/remove-teacher-from-class.use-case";

@Controller("classes")
@ApiTags("Classes")
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
    private readonly assignTeacherToClassUseCase: AssignTeacherToClassUseCase,
    private readonly getClassTeachersUseCase: GetClassTeachersUseCase,
    private readonly removeTeacherFromClassUseCase: RemoveTeacherFromClassUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: "Class created successfully",
    type: ClassResponse,
  })
  @ApiOperation({
    summary: "Create a new class",
    description: "Creates a new class for a specific grade level and school year.",
  })
  async create(@Body() dto: CreateClassRequest) {
    return await this.createClassUseCase.execute(dto);
  }

  @Get()
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
  async findAll(@Query() query: StandardRequestDto) {
    return await this.getAllClassesUseCase.execute(query);
  }

  @Get(":id")
  @StandardResponse({
    message: "Class retrieved successfully",
    type: ClassResponse,
  })
  @ApiOperation({
    summary: "Get class by ID",
    description: "Retrieve a single class by its unique identifier.",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findById(@Param("id") id: string) {
    return await this.getClassByIdUseCase.execute(id);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Class updated successfully",
    type: ClassResponse,
  })
  @ApiOperation({
    summary: "Update class",
    description: "Update class name or description.",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateClassRequest) {
    return await this.updateClassUseCase.execute(id, dto);
  }

  @Delete(":id")
  @StandardResponse({
    message: "Class deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete class",
    description: "Delete a class. This will also remove all enrollments and teacher assignments.",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async delete(@Param("id") id: string) {
    await this.deleteClassUseCase.execute(id);
    return null;
  }

  // ==================== Enrollment Endpoints ====================

  @Post(":id/enrollments")
  @StandardResponse({
    message: "Student enrolled successfully",
    type: EnrollmentResponse,
  })
  @ApiOperation({
    summary: "Enroll a student in class",
    description: "Enroll a student in this class with the specified enrollment date.",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async enrollStudent(@Param("id") classId: string, @Body() dto: EnrollStudentRequest) {
    return await this.enrollStudentUseCase.execute({
      classId,
      studentId: dto.studentId,
      enrollmentDate: new Date(dto.enrollmentDate),
      note: dto.note,
    });
  }

  @Get(":id/enrollments")
  @StandardResponse({
    message: "Enrollments retrieved successfully",
    type: EnrollmentResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get class enrollments",
    description: "Get all students enrolled in this class.",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getEnrollments(@Param("id") classId: string) {
    return await this.getClassEnrollmentsUseCase.execute(classId);
  }

  @Delete(":classId/enrollments/:enrollmentId")
  @StandardResponse({
    message: "Student unenrolled successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Unenroll student from class",
    description: "Remove a student's enrollment from this class.",
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
  async unenrollStudent(@Param("enrollmentId") enrollmentId: string) {
    await this.unenrollStudentUseCase.execute(enrollmentId);
    return null;
  }

  // ==================== Teacher Assignment Endpoints ====================

  @Post(":id/teachers")
  @StandardResponse({
    message: "Teacher assigned successfully",
    type: ClassTeacherResponse,
  })
  @ApiOperation({
    summary: "Assign a teacher to class",
    description: "Assign a teacher to teach a specific subject in this class.",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async assignTeacher(@Param("id") classId: string, @Body() dto: AssignTeacherRequest) {
    return await this.assignTeacherToClassUseCase.execute({
      classId,
      teacherId: dto.teacherId,
      subjectId: dto.subjectId,
    });
  }

  @Get(":id/teachers")
  @StandardResponse({
    message: "Class teachers retrieved successfully",
    type: ClassTeacherResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get class teachers",
    description: "Get all teachers assigned to this class.",
  })
  @ApiParam({
    name: "id",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getTeachers(@Param("id") classId: string) {
    return await this.getClassTeachersUseCase.execute(classId);
  }

  @Delete(":classId/teachers/:teacherId/subjects/:subjectId")
  @StandardResponse({
    message: "Teacher removed from class successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Remove teacher from class",
    description: "Remove a teacher's assignment from this class for a specific subject.",
  })
  @ApiParam({
    name: "classId",
    description: "Class UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "teacherId",
    description: "Teacher UUID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @ApiParam({
    name: "subjectId",
    description: "Subject UUID",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  async removeTeacher(
    @Param("classId") classId: string,
    @Param("teacherId") teacherId: string,
    @Param("subjectId") subjectId: string,
  ) {
    await this.removeTeacherFromClassUseCase.execute({ classId, teacherId, subjectId });
    return null;
  }
}
