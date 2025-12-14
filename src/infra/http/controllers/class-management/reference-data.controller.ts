import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";

import {
  GradeLevelResponse,
  SchoolYearResponse,
  SubjectResponse,
} from "../../dtos/class-management/class.response";

// Use Cases
import { GetAllGradeLevelsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-grade-levels.use-case";
import { GetAllSchoolYearsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-school-years.use-case";
import { GetAllSubjectsUseCase } from "@/application/class-management/use-cases/reference-data/get-all-subjects.use-case";

@Controller("reference-data")
@ApiTags("Reference Data")
export class ReferenceDataController {
  constructor(
    private readonly getAllGradeLevelsUseCase: GetAllGradeLevelsUseCase,
    private readonly getAllSchoolYearsUseCase: GetAllSchoolYearsUseCase,
    private readonly getAllSubjectsUseCase: GetAllSubjectsUseCase,
  ) {}

  @Get("grade-levels")
  @StandardResponse({
    message: "Grade levels retrieved successfully",
    type: GradeLevelResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all grade levels",
    description: "Retrieve all grade levels ordered by their display order.",
  })
  async getGradeLevels() {
    return await this.getAllGradeLevelsUseCase.execute();
  }

  @Get("school-years")
  @StandardResponse({
    message: "School years retrieved successfully",
    type: SchoolYearResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all school years",
    description: "Retrieve all school years ordered by start date (most recent first).",
  })
  async getSchoolYears() {
    return await this.getAllSchoolYearsUseCase.execute();
  }

  @Get("subjects")
  @StandardResponse({
    message: "Subjects retrieved successfully",
    type: SubjectResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all subjects",
    description: "Retrieve all subjects ordered by name.",
  })
  async getSubjects() {
    return await this.getAllSubjectsUseCase.execute();
  }
}
