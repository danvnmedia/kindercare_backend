import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { GradeLevelRepository } from "../../ports/grade-level.repository";

@Injectable()
export class GetGradeLevelByIdUseCase {
  private readonly logger = new Logger(GetGradeLevelByIdUseCase.name);

  constructor(
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(id: string, campusId: string): Promise<GradeLevel> {
    this.logger.log(`Fetching grade level by ID: ${id}`);

    const gradeLevel = await this.gradeLevelRepository.findById(id);

    if (!gradeLevel) {
      throw new NotFoundException(`Grade level with ID ${id} not found`);
    }

    if (gradeLevel.campusId !== campusId) {
      throw new NotFoundException(
        `Grade level with ID ${id} not found in this campus`,
      );
    }

    return gradeLevel;
  }
}
