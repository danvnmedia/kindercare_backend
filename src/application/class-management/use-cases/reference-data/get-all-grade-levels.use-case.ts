import { Injectable, Inject, Logger } from "@nestjs/common";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

@Injectable()
export class GetAllGradeLevelsUseCase {
  private readonly logger = new Logger(GetAllGradeLevelsUseCase.name);

  constructor(
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(params: StandardRequest): Promise<PaginatedResult<GradeLevel>> {
    try {
      this.logger.log(
        `Fetching grade levels: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.gradeLevelRepository.findAllWithClasses(params);

      this.logger.log(
        `Found ${result.pagination.count} grade levels, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch grade levels: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
