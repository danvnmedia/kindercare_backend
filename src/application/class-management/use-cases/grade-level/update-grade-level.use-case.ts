import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import {
  GradeLevel,
  UpdateGradeLevelData,
} from "@/domain/class-management/entities/grade-level.entity";
import { GradeLevelRepository } from "../../ports/grade-level.repository";

@Injectable()
export class UpdateGradeLevelUseCase {
  private readonly logger = new Logger(UpdateGradeLevelUseCase.name);

  constructor(
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(id: string, input: UpdateGradeLevelData): Promise<GradeLevel> {
    try {
      this.logger.log(`Updating grade level: ${id}`);

      // Step 1: Find existing grade level
      const gradeLevel = await this.gradeLevelRepository.findById(id);
      if (!gradeLevel) {
        throw new NotFoundException(`Grade level with ID ${id} not found`);
      }

      // Step 2: Check for name uniqueness if name is being updated (within campus)
      if (input.name && input.name !== gradeLevel.name) {
        const existingByName =
          await this.gradeLevelRepository.findByNameAndCampus(
            input.name,
            gradeLevel.campusId,
          );
        if (existingByName) {
          throw new ConflictException(
            `Grade level "${input.name}" already exists`,
          );
        }
      }

      // Step 3: Check for order uniqueness if order is being updated (within campus)
      if (input.order !== undefined && input.order !== gradeLevel.order) {
        const existingByOrder =
          await this.gradeLevelRepository.findByOrderAndCampus(
            input.order,
            gradeLevel.campusId,
          );
        if (existingByOrder) {
          throw new ConflictException(
            `Grade level with order ${input.order} already exists`,
          );
        }
      }

      // Step 4: Update grade level using entity methods
      if (input.name !== undefined) {
        gradeLevel.updateName(input.name);
      }
      if (input.order !== undefined) {
        gradeLevel.updateOrder(input.order);
      }
      if (input.isArchived !== undefined) {
        if (input.isArchived) {
          gradeLevel.archive();
        } else {
          gradeLevel.unarchive();
        }
      }

      // Step 5: Save updated grade level
      const updatedGradeLevel =
        await this.gradeLevelRepository.update(gradeLevel);

      this.logger.log(`Grade level updated successfully: ${id}`);
      return updatedGradeLevel;
    } catch (error) {
      this.logger.error(
        `Failed to update grade level: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
