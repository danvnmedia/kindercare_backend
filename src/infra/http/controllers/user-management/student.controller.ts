import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { UserInterceptor } from "../../interceptors/user.interceptor";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { CampusContext, RequireCampusAccess } from "../../decorators";
import {
  CreateStudentRequest,
  UpdateStudentRequest,
  StudentResponse,
  LinkStudentGuardianRequest,
  StudentGuardianResponse,
  LinkStudentGuardianResponse,
} from "../../dtos/user-management/student";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

// Use Cases
import { CreateStudentUseCase } from "@/application/user-management/use-cases/student/create-student.use-case";
import { GetAllStudentsUseCase } from "@/application/user-management/use-cases/student/get-all-students.use-case";
import { UpdateStudentUseCase } from "@/application/user-management/use-cases/student/update-student.use-case";
import { DeleteStudentUseCase } from "@/application/user-management/use-cases/student/delete-student.use-case";
import { LinkStudentWithGuardianUseCase } from "@/application/user-management/use-cases/student/link-student-with-guardian.use-case";
import { UnlinkStudentFromGuardianUseCase } from "@/application/user-management/use-cases/student/unlink-student-from-guardian.use-case";
import { GetStudentGuardiansUseCase } from "@/application/user-management/use-cases/student/get-student-guardians.use-case";
import { StandardRequestParam } from "@/core/modules/standard-response";

@Controller("students")
@ApiTags("Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(UserInterceptor)
export class StudentController {
  constructor(
    private readonly createStudentUseCase: CreateStudentUseCase,
    private readonly getAllStudentsUseCase: GetAllStudentsUseCase,
    private readonly updateStudentUseCase: UpdateStudentUseCase,
    private readonly deleteStudentUseCase: DeleteStudentUseCase,
    private readonly linkStudentWithGuardianUseCase: LinkStudentWithGuardianUseCase,
    private readonly unlinkStudentFromGuardianUseCase: UnlinkStudentFromGuardianUseCase,
    private readonly getStudentGuardiansUseCase: GetStudentGuardiansUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: "Student created successfully",
    type: StudentResponse,
  })
  @ApiOperation({
    summary: "Create a new student",
    description:
      "Creates a new student with personal information and optional guardian assignment. Can also create user account with Clerk if requested.",
  })
  async create(@Body() dto: CreateStudentRequest) {
    return await this.createStudentUseCase.execute({
      ...dto,
      gender: dto.gender as Gender,
    });
  }

  @Get()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Students retrieved successfully",
    type: StudentResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all students in a campus",
    description:
      "Retrieve all students within a specific campus with advanced filtering, sorting, and pagination. Supports filtering by fullName, nickname, classId, gender, enrollmentDate. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).",
  })
  @ApiHeader({
    name: "x-campus-id",
    description: "Campus ID to scope the request",
    required: true,
  })
  async findAll(
    @CampusContext() campusId: string,
    @StandardRequestParam() query: StandardRequestDto,
  ) {
    return this.getAllStudentsUseCase.execute({ campusId, params: query });
  }

  @Patch(":id")
  @StandardResponse({
    message: "Student updated successfully",
    type: StudentResponse,
  })
  @ApiOperation({
    summary: "Update a student",
    description:
      "Updates student profile information. All fields are optional. Email and phone number uniqueness is validated.",
  })
  @ApiParam({
    name: "id",
    description: "Student ID",
    type: "string",
    format: "uuid",
  })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentRequest,
  ) {
    return await this.updateStudentUseCase.execute(id, {
      ...dto,
      gender: dto.gender as Gender | undefined,
    });
  }

  @Delete(":id")
  @StandardResponse({
    message: "Student deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete a student",
    description: "Permanently deletes a student by ID.",
  })
  @ApiParam({
    name: "id",
    description: "Student ID",
    type: "string",
    format: "uuid",
  })
  async delete(@Param("id", ParseUUIDPipe) id: string) {
    await this.deleteStudentUseCase.execute(id);
    return null;
  }

  // ========== Student-Guardian Relationship Endpoints ==========

  @Post(":id/guardians")
  @StandardResponse({
    message: "Guardian linked to student successfully",
    type: LinkStudentGuardianResponse,
  })
  @ApiOperation({
    summary: "Link a guardian to a student",
    description:
      "Creates a relationship between a student and a guardian with a specified relationship type (FATHER, MOTHER, GUARDIAN).",
  })
  @ApiParam({
    name: "id",
    description: "Student ID",
    type: "string",
    format: "uuid",
  })
  async linkGuardian(
    @Param("id", ParseUUIDPipe) studentId: string,
    @Body() dto: LinkStudentGuardianRequest,
  ) {
    return await this.linkStudentWithGuardianUseCase.execute({
      studentId,
      guardianId: dto.guardianId,
      relationshipId: dto.relationshipId,
    });
  }

  @Delete(":id/guardians/:guardianId")
  @StandardResponse({
    message: "Guardian unlinked from student successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Unlink a guardian from a student",
    description: "Removes the relationship between a student and a guardian.",
  })
  @ApiParam({
    name: "id",
    description: "Student ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "guardianId",
    description: "Guardian ID to unlink",
    type: "string",
    format: "uuid",
  })
  async unlinkGuardian(
    @Param("id", ParseUUIDPipe) studentId: string,
    @Param("guardianId", ParseUUIDPipe) guardianId: string,
  ) {
    await this.unlinkStudentFromGuardianUseCase.execute({
      studentId,
      guardianId,
    });
    return null;
  }

  @Get(":id/guardians")
  @StandardResponse({
    message: "Student guardians retrieved successfully",
    type: StudentGuardianResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all guardians of a student",
    description:
      "Retrieves all guardians linked to a student with their relationship types.",
  })
  @ApiParam({
    name: "id",
    description: "Student ID",
    type: "string",
    format: "uuid",
  })
  async getGuardians(@Param("id", ParseUUIDPipe) studentId: string) {
    return await this.getStudentGuardiansUseCase.execute(studentId);
  }
}
