import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBearerAuth,
} from "@nestjs/swagger";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { StandardRequestParam } from "@/core/modules/standard-response";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { UserInterceptor } from "../../interceptors/user.interceptor";

import {
  GradeLevelResponse,
  SchoolYearResponse,
  SubjectResponse,
} from "../../dtos/class-management/class.response";

import { CreateSchoolYearRequest } from "../../dtos/class-management/create-school-year.request";
import { UpdateSchoolYearRequest } from "../../dtos/class-management/update-school-year.request";
import { CreateGradeLevelRequest } from "../../dtos/class-management/create-grade-level.request";
import { UpdateGradeLevelRequest } from "../../dtos/class-management/update-grade-level.request";
import { ReorderGradeLevelsRequest } from "../../dtos/class-management/reorder-grade-levels.request";

// Use Cases - Read
import { GetAllGradeLevelsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-grade-levels.use-case";
import { GetAllSchoolYearsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-school-years.use-case";
import { GetAllSubjectsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-subjects.use-case";

// Use Cases - School Year CUD
import { CreateSchoolYearUseCase } from "@/application/class-management/use-cases/school-year/create-school-year.use-case";
import { UpdateSchoolYearUseCase } from "@/application/class-management/use-cases/school-year/update-school-year.use-case";
import { DeleteSchoolYearUseCase } from "@/application/class-management/use-cases/school-year/delete-school-year.use-case";

// Use Cases - Grade Level CUD
import { CreateGradeLevelUseCase } from "@/application/class-management/use-cases/grade-level/create-grade-level.use-case";
import { UpdateGradeLevelUseCase } from "@/application/class-management/use-cases/grade-level/update-grade-level.use-case";
import { DeleteGradeLevelUseCase } from "@/application/class-management/use-cases/grade-level/delete-grade-level.use-case";
import { ReorderGradeLevelsUseCase } from "@/application/class-management/use-cases/grade-level/reorder-grade-levels.use-case";

@Controller("reference-data")
@ApiTags("Reference Data")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(UserInterceptor)
export class ReferenceDataController {
  constructor(
    // Read Use Cases
    private readonly getAllGradeLevelsUseCase: GetAllGradeLevelsUseCase,
    private readonly getAllSchoolYearsUseCase: GetAllSchoolYearsUseCase,
    private readonly getAllSubjectsUseCase: GetAllSubjectsUseCase,
    // School Year CUD Use Cases
    private readonly createSchoolYearUseCase: CreateSchoolYearUseCase,
    private readonly updateSchoolYearUseCase: UpdateSchoolYearUseCase,
    private readonly deleteSchoolYearUseCase: DeleteSchoolYearUseCase,
    // Grade Level CUD Use Cases
    private readonly createGradeLevelUseCase: CreateGradeLevelUseCase,
    private readonly updateGradeLevelUseCase: UpdateGradeLevelUseCase,
    private readonly deleteGradeLevelUseCase: DeleteGradeLevelUseCase,
    private readonly reorderGradeLevelsUseCase: ReorderGradeLevelsUseCase,
  ) {}

  // ==================== Grade Level Endpoints ====================

  @Get("grade-levels")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Grade levels retrieved successfully",
    type: GradeLevelResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all grade levels",
    description:
      "Retrieve all grade levels with pagination, filtering, and sorting. Supports filtering by name, order, isArchived. Default sort by order ascending.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to filter grade levels",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getGradeLevels(
    @CampusContext() campusId: string,
    @StandardRequestParam() query: StandardRequestDto,
  ) {
    return await this.getAllGradeLevelsUseCase.execute(campusId, query);
  }

  @Post("grade-levels")
  @StandardResponse({
    message: "Grade level created successfully",
    type: GradeLevelResponse,
  })
  @ApiOperation({
    summary: "Create a new grade level",
    description: "Create a new grade level with a unique name and order.",
  })
  async createGradeLevel(@Body() dto: CreateGradeLevelRequest) {
    return await this.createGradeLevelUseCase.execute(dto);
  }

  @Patch("grade-levels/:id")
  @StandardResponse({
    message: "Grade level updated successfully",
    type: GradeLevelResponse,
  })
  @ApiOperation({
    summary: "Update a grade level",
    description: "Update grade level name, order, or archived status.",
  })
  @ApiParam({
    name: "id",
    description: "Grade Level UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async updateGradeLevel(
    @Param("id") id: string,
    @Body() dto: UpdateGradeLevelRequest,
  ) {
    return await this.updateGradeLevelUseCase.execute(id, dto);
  }

  @Delete("grade-levels/:id")
  @StandardResponse({
    message: "Grade level deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete a grade level",
    description:
      "Delete a grade level. Will fail if classes are associated with it.",
  })
  @ApiParam({
    name: "id",
    description: "Grade Level UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async deleteGradeLevel(@Param("id") id: string) {
    await this.deleteGradeLevelUseCase.execute(id);
    return null;
  }

  @Post("grade-levels/reorder")
  @StandardResponse({
    message: "Grade levels reordered successfully",
    type: GradeLevelResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Reorder grade levels",
    description:
      "Reorder grade levels based on the provided array of IDs. The order field will be set based on the array index (index 0 = order 1, index 1 = order 2, etc.).",
  })
  async reorderGradeLevels(@Body() dto: ReorderGradeLevelsRequest) {
    return await this.reorderGradeLevelsUseCase.execute(dto);
  }

  // ==================== School Year Endpoints ====================

  @Get("school-years")
  @RequireCampusAccess()
  @StandardResponse({
    message: "School years retrieved successfully",
    type: SchoolYearResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all school years",
    description:
      "Retrieve all school years with pagination, filtering, and sorting. Supports filtering by name, isArchived, startDate, endDate. Default sort by startDate descending.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to filter school years",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getSchoolYears(
    @CampusContext() campusId: string,
    @StandardRequestParam() query: StandardRequestDto,
  ) {
    return await this.getAllSchoolYearsUseCase.execute(campusId, query);
  }

  @Post("school-years")
  @StandardResponse({
    message: "School year created successfully",
    type: SchoolYearResponse,
  })
  @ApiOperation({
    summary: "Create a new school year",
    description: "Create a new school year with a unique name and date range.",
  })
  async createSchoolYear(@Body() dto: CreateSchoolYearRequest) {
    return await this.createSchoolYearUseCase.execute({
      name: dto.name,
      campusId: dto.campusId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      isArchived: dto.isArchived,
    });
  }

  @Patch("school-years/:id")
  @StandardResponse({
    message: "School year updated successfully",
    type: SchoolYearResponse,
  })
  @ApiOperation({
    summary: "Update a school year",
    description: "Update school year name, dates, or archived status.",
  })
  @ApiParam({
    name: "id",
    description: "School Year UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async updateSchoolYear(
    @Param("id") id: string,
    @Body() dto: UpdateSchoolYearRequest,
  ) {
    return await this.updateSchoolYearUseCase.execute(id, {
      name: dto.name,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      isArchived: dto.isArchived,
    });
  }

  @Delete("school-years/:id")
  @StandardResponse({
    message: "School year deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete a school year",
    description:
      "Delete a school year. Will fail if classes are associated with it.",
  })
  @ApiParam({
    name: "id",
    description: "School Year UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async deleteSchoolYear(@Param("id") id: string) {
    await this.deleteSchoolYearUseCase.execute(id);
    return null;
  }

  // ==================== Subject Endpoints ====================

  @Get("subjects")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Subjects retrieved successfully",
    type: SubjectResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all subjects",
    description: "Retrieve all subjects ordered by name.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to filter subjects",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getSubjects(@CampusContext() campusId: string) {
    return await this.getAllSubjectsUseCase.execute(campusId);
  }
}
