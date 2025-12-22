import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { GradeLevelRepository } from "../../ports/grade-level.repository";

export interface ReorderGradeLevelsInput {
  ids: string[];
}

@Injectable()
export class ReorderGradeLevelsUseCase {
  private readonly logger = new Logger(ReorderGradeLevelsUseCase.name);

  constructor(
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(input: ReorderGradeLevelsInput): Promise<GradeLevel[]> {
    this.logger.log(`Reordering ${input.ids.length} grade levels`);

    // Step 1: Validate all IDs exist
    const missingIds: string[] = [];
    for (const id of input.ids) {
      const gradeLevel = await this.gradeLevelRepository.findById(id);
      if (!gradeLevel) {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Grade level(s) not found: ${missingIds.join(", ")}`,
      );
    }

    // Step 2: Reorder grade levels
    const reorderedGradeLevels = await this.gradeLevelRepository.reorder(
      input.ids,
    );

    this.logger.log(
      `Successfully reordered ${reorderedGradeLevels.length} grade levels`,
    );

    return reorderedGradeLevels;
  }
}
