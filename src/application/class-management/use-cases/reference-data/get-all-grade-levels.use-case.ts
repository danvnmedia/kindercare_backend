import { Injectable, Inject, Logger } from "@nestjs/common";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";

@Injectable()
export class GetAllGradeLevelsUseCase {
  private readonly logger = new Logger(GetAllGradeLevelsUseCase.name);

  constructor(
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(): Promise<GradeLevel[]> {
    try {
      this.logger.log("Fetching all grade levels");

      const result = await this.gradeLevelRepository.findAll();

      this.logger.log(`Found ${result.length} grade levels`);

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
