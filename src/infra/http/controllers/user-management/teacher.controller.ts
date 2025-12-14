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

import { Gender } from "@/domain/user-management/enums/gender.enum";
import { TeacherType } from "@/domain/user-management/enums/teacher-type.enum";
import {
  CreateTeacherRequest,
  UpdateTeacherRequest,
  TeacherResponse,
} from "../../dtos/user-management/teacher";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

// Use Cases
import { CreateTeacherUseCase } from "@/application/user-management/use-cases/teacher/create-teacher.use-case";
import { GetTeacherByIdUseCase } from "@/application/user-management/use-cases/teacher/get-teacher-by-id.use-case";
import { GetAllTeachersUseCase } from "@/application/user-management/use-cases/teacher/get-all-teachers.use-case";
import { UpdateTeacherUseCase } from "@/application/user-management/use-cases/teacher/update-teacher.use-case";
import { ArchiveTeacherUseCase } from "@/application/user-management/use-cases/teacher/archive-teacher.use-case";
import { RestoreTeacherUseCase } from "@/application/user-management/use-cases/teacher/restore-teacher.use-case";

@Controller("teachers")
@ApiTags("Teachers")
export class TeacherController {
  constructor(
    private readonly createTeacherUseCase: CreateTeacherUseCase,
    private readonly getTeacherByIdUseCase: GetTeacherByIdUseCase,
    private readonly getAllTeachersUseCase: GetAllTeachersUseCase,
    private readonly updateTeacherUseCase: UpdateTeacherUseCase,
    private readonly archiveTeacherUseCase: ArchiveTeacherUseCase,
    private readonly restoreTeacherUseCase: RestoreTeacherUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: "Teacher created successfully",
    type: TeacherResponse,
  })
  @ApiOperation({
    summary: "Create a new teacher",
    description:
      "Creates a new teacher with personal information and automatically creates a Clerk account with weak password (ChangeMe123!) that forces password reset on first login. The teacher is automatically assigned a role based on their teacherType (teacher, nurse, principal, or staff).",
  })
  async create(@Body() dto: CreateTeacherRequest) {
    return await this.createTeacherUseCase.execute({
      ...dto,
      teacherType: dto.teacherType as TeacherType,
      gender: dto.gender as Gender | undefined,
    });
  }

  @Get()
  @StandardResponse({
    message: "Teachers retrieved successfully",
    type: TeacherResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all teachers",
    description:
      "Retrieve all teachers with advanced filtering, sorting, and pagination. Supports filtering by fullName, email, phoneNumber, teacherType, gender, isArchived. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).",
  })
  async findAll(@Query() query: StandardRequestDto) {
    return await this.getAllTeachersUseCase.execute(query);
  }

  @Get(":id")
  @StandardResponse({
    message: "Teacher retrieved successfully",
    type: TeacherResponse,
  })
  @ApiOperation({
    summary: "Get teacher by ID",
    description: "Retrieve a single teacher by their unique identifier.",
  })
  @ApiParam({
    name: "id",
    description: "Teacher UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findById(@Param("id") id: string) {
    return await this.getTeacherByIdUseCase.execute(id);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Teacher updated successfully",
    type: TeacherResponse,
  })
  @ApiOperation({
    summary: "Update teacher",
    description:
      "Update teacher information. If teacherType is changed, the associated user role will also be updated accordingly.",
  })
  @ApiParam({
    name: "id",
    description: "Teacher UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateTeacherRequest) {
    return await this.updateTeacherUseCase.execute(id, {
      ...dto,
      teacherType: dto.teacherType as TeacherType | undefined,
      gender: dto.gender as Gender | undefined,
    });
  }

  @Delete(":id")
  @StandardResponse({
    message: "Teacher archived successfully",
    type: TeacherResponse,
  })
  @ApiOperation({
    summary: "Archive teacher (soft delete)",
    description:
      "Archives a teacher (soft delete). The teacher's linked user account will also be deactivated.",
  })
  @ApiParam({
    name: "id",
    description: "Teacher UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async archive(@Param("id") id: string) {
    return await this.archiveTeacherUseCase.execute(id);
  }

  @Post(":id/restore")
  @StandardResponse({
    message: "Teacher restored successfully",
    type: TeacherResponse,
  })
  @ApiOperation({
    summary: "Restore archived teacher",
    description:
      "Restores a previously archived teacher. The teacher's linked user account will also be reactivated.",
  })
  @ApiParam({
    name: "id",
    description: "Teacher UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async restore(@Param("id") id: string) {
    return await this.restoreTeacherUseCase.execute(id);
  }
}
