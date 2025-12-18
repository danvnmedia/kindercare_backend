import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { ClassRepository } from "../../ports/class.repository";

@Injectable()
export class DeleteClassUseCase {
  private readonly logger = new Logger(DeleteClassUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting class: ${id}`);

      // Step 1: Find existing class
      const classEntity = await this.classRepository.findById(id);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${id} not found`);
      }

      // Step 2: Delete class
      await this.classRepository.delete(id);

      this.logger.log(`Class deleted successfully: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete class: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
