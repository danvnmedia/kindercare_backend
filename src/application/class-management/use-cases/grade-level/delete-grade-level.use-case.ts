import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { ClassRepository } from "../../ports/class.repository";

@Injectable()
export class DeleteGradeLevelUseCase {
  private readonly logger = new Logger(DeleteGradeLevelUseCase.name);

  constructor(
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting grade level: ${id}`);

      // Step 1: Find existing grade level
      const gradeLevel = await this.gradeLevelRepository.findById(id);
      if (!gradeLevel) {
        throw new NotFoundException(`Grade level with ID ${id} not found`);
      }

      // Step 2: Check for dependent classes
      const dependentClasses =
        await this.classRepository.findByGradeLevelId(id);
      if (dependentClasses.length > 0) {
        throw new ConflictException(
          `Cannot delete grade level: ${dependentClasses.length} class(es) are associated with it`,
        );
      }

      // Step 3: Delete grade level
      await this.gradeLevelRepository.delete(id);

      this.logger.log(`Grade level deleted successfully: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete grade level: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
