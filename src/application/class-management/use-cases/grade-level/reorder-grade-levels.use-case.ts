import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { GradeLevelRepository } from "../../ports/grade-level.repository";

export interface ReorderGradeLevelsInput {
  campusId: string;
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

    // Step 1: Validate all IDs exist and belong to the specified campus
    const missingIds: string[] = [];
    for (const id of input.ids) {
      const gradeLevel = await this.gradeLevelRepository.findById(id);
      if (!gradeLevel) {
        missingIds.push(id);
      } else if (gradeLevel.campusId !== input.campusId) {
        // Grade level belongs to a different campus - return 404 for security
        throw new NotFoundException(
          `Grade level with ID ${id} not found in this campus`,
        );
      }
    }

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Grade level(s) not found: ${missingIds.join(", ")}`,
      );
    }

    // Step 2: Reorder grade levels within the campus
    const reorderedGradeLevels = await this.gradeLevelRepository.reorder(
      input.campusId,
      input.ids,
    );

    this.logger.log(
      `Successfully reordered ${reorderedGradeLevels.length} grade levels`,
    );

    return reorderedGradeLevels;
  }
}
