import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import {
  Class,
  UpdateClassData,
} from "@/domain/class-management/entities/class.entity";
import { ClassRepository } from "../../ports/class.repository";

@Injectable()
export class UpdateClassUseCase {
  private readonly logger = new Logger(UpdateClassUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(id: string, input: UpdateClassData): Promise<Class> {
    try {
      this.logger.log(`Updating class: ${id}`);

      // Step 1: Find existing class
      const classEntity = await this.classRepository.findById(id);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${id} not found`);
      }

      // Step 2: Check name uniqueness if name is being changed
      if (input.name && input.name.trim() !== classEntity.name) {
        const existingClass =
          await this.classRepository.findByNameInContextAndCampus(
            input.name,
            classEntity.campusId,
            classEntity.schoolYearId,
            classEntity.gradeLevelId,
          );
        if (existingClass && existingClass.id !== id) {
          throw new ConflictException(
            `Class "${input.name}" already exists in this grade level and school year`,
          );
        }
      }

      // Step 3: Update class
      classEntity.update(input);

      // Step 4: Save updated class
      const updatedClass = await this.classRepository.update(classEntity);

      this.logger.log(`Class updated successfully: ${id}`);
      return updatedClass;
    } catch (error) {
      this.logger.error(
        `Failed to update class: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
