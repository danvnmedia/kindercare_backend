import { Injectable, Inject, Logger } from "@nestjs/common";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

@Injectable()
export class GetAllSchoolYearsUseCase {
  private readonly logger = new Logger(GetAllSchoolYearsUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
  ) {}

  async execute(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<SchoolYear>> {
    try {
      this.logger.log(
        `Fetching school years: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.schoolYearRepository.findAll(campusId, params);

      this.logger.log(
        `Found ${result.pagination.count} school years, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch school years: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
