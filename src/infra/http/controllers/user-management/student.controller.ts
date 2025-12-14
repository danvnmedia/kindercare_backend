import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import {
  CreateStudentRequest,
  StudentResponse,
  LinkStudentGuardianRequest,
  StudentGuardianResponse,
  LinkStudentGuardianResponse,
} from "../../dtos/user-management/student";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

// Use Cases
import { CreateStudentUseCase } from "@/application/user-management/use-cases/student/create-student.use-case";
import { GetAllStudentsUseCase } from "@/application/user-management/use-cases/student/get-all-students.use-case";
import { LinkStudentWithGuardianUseCase } from "@/application/user-management/use-cases/student/link-student-with-guardian.use-case";
import { UnlinkStudentFromGuardianUseCase } from "@/application/user-management/use-cases/student/unlink-student-from-guardian.use-case";
import { GetStudentGuardiansUseCase } from "@/application/user-management/use-cases/student/get-student-guardians.use-case";
import { StandardRequestParam } from "@/core/modules/standard-response";

@Controller("students")
@ApiTags("Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class StudentController {
  constructor(
    private readonly createStudentUseCase: CreateStudentUseCase,
    private readonly getAllStudentsUseCase: GetAllStudentsUseCase,
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
  @StandardResponse({
    message: "Students retrieved successfully",
    type: StudentResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all students",
    description:
      "Retrieve all students with advanced filtering, sorting, and pagination. Supports filtering by fullName, nickname, classId, gender, enrollmentDate. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).",
  })
  async findAll(@StandardRequestParam() query: StandardRequestDto) {
    return this.getAllStudentsUseCase.execute(query);
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
