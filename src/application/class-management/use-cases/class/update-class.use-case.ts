import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
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

      // Step 2: Update class
      classEntity.update(input);

      // Step 3: Save updated class
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
