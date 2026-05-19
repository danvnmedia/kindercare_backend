import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiHeader,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { StandardRequestParam } from "@/core/modules/standard-response";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

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

// Use Cases - Get By ID
import { GetGradeLevelByIdUseCase } from "@/application/class-management/use-cases/grade-level/get-grade-level-by-id.use-case";
import { GetSchoolYearByIdUseCase } from "@/application/class-management/use-cases/school-year/get-school-year-by-id.use-case";

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
export class ReferenceDataController {
  constructor(
    // Read Use Cases
    private readonly getAllGradeLevelsUseCase: GetAllGradeLevelsUseCase,
    private readonly getGradeLevelByIdUseCase: GetGradeLevelByIdUseCase,
    private readonly getAllSchoolYearsUseCase: GetAllSchoolYearsUseCase,
    private readonly getSchoolYearByIdUseCase: GetSchoolYearByIdUseCase,
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

  @Get("grade-levels/:id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Grade level retrieved successfully",
    type: GradeLevelResponse,
  })
  @ApiOperation({
    summary: "Get a grade level by ID",
    description:
      "Retrieve a single grade level by its ID within the specified campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to verify grade level access",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Grade Level UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getGradeLevelById(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ) {
    return await this.getGradeLevelByIdUseCase.execute(id, campusId);
  }

  @Post("grade-levels")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Grade level created successfully",
    type: GradeLevelResponse,
  })
  @ApiOperation({
    summary: "Create a new grade level",
    description: "Create a new grade level with a unique name and order.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the grade level creation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async createGradeLevel(
    @CampusContext() campusId: string,
    @Body() dto: CreateGradeLevelRequest,
  ) {
    return await this.createGradeLevelUseCase.execute({
      ...dto,
      campusId,
    });
  }

  @Patch("grade-levels/:id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Grade level updated successfully",
    type: GradeLevelResponse,
  })
  @ApiOperation({
    summary: "Update a grade level",
    description: "Update grade level name, order, or archived status.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the grade level update",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Grade Level UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async updateGradeLevel(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdateGradeLevelRequest,
  ) {
    return await this.updateGradeLevelUseCase.execute(id, campusId, dto);
  }

  @Delete("grade-levels/:id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Grade level deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete a grade level",
    description:
      "Delete a grade level. Will fail if classes are associated with it.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the grade level deletion",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Grade Level UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async deleteGradeLevel(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ) {
    await this.deleteGradeLevelUseCase.execute(id, campusId);
    return null;
  }

  @Post("grade-levels/reorder")
  @RequireCampusAccess()
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
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the reorder operation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async reorderGradeLevels(
    @CampusContext() campusId: string,
    @Body() dto: ReorderGradeLevelsRequest,
  ) {
    return await this.reorderGradeLevelsUseCase.execute({
      ...dto,
      campusId,
    });
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

  @Get("school-years/:id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "School year retrieved successfully",
    type: SchoolYearResponse,
  })
  @ApiOperation({
    summary: "Get a school year by ID",
    description:
      "Retrieve a single school year by its ID within the specified campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to verify school year access",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "School Year UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getSchoolYearById(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ) {
    return await this.getSchoolYearByIdUseCase.execute(id, campusId);
  }

  @Post("school-years")
  @RequireCampusAccess()
  @StandardResponse({
    message: "School year created successfully",
    type: SchoolYearResponse,
  })
  @ApiOperation({
    summary: "Create a new school year",
    description: "Create a new school year with a unique name and date range.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the school year creation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async createSchoolYear(
    @CampusContext() campusId: string,
    @Body() dto: CreateSchoolYearRequest,
  ) {
    return await this.createSchoolYearUseCase.execute({
      name: dto.name,
      campusId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      isArchived: dto.isArchived,
    });
  }

  @Patch("school-years/:id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "School year updated successfully",
    type: SchoolYearResponse,
  })
  @ApiOperation({
    summary: "Update a school year",
    description: "Update school year name, dates, or archived status.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the school year update",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "School Year UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async updateSchoolYear(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdateSchoolYearRequest,
  ) {
    return await this.updateSchoolYearUseCase.execute(id, {
      campusId,
      name: dto.name,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      isArchived: dto.isArchived,
    });
  }

  @Delete("school-years/:id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "School year deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete a school year",
    description:
      "Delete a school year. Will fail if classes are associated with it.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the school year deletion",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "School Year UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async deleteSchoolYear(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ) {
    await this.deleteSchoolYearUseCase.execute(id, campusId);
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
