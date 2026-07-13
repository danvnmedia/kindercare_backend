import {
  ConflictException,
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import {
  ClassDeletionConflictError,
  ClassRepository,
} from "../../ports/class.repository";

@Injectable()
export class DeleteClassUseCase {
  private readonly logger = new Logger(DeleteClassUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(id: string, campusId?: string): Promise<void> {
    try {
      this.logger.log(`Deleting class: ${id}`);

      // Step 1: Find existing class
      const classEntity = await this.classRepository.findById(id);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${id} not found`);
      }

      // Step 2: Verify class belongs to the specified campus (if campusId provided)
      if (campusId && classEntity.campusId !== campusId) {
        throw new NotFoundException(
          `Class with ID ${id} not found in this campus`,
        );
      }

      // Step 3: Delete class
      await this.classRepository.delete(id);

      this.logger.log(`Class deleted successfully: ${id}`);
    } catch (error) {
      if (error instanceof ClassDeletionConflictError) {
        throw new ConflictException(
          "Class cannot be deleted because it is still used by posts, enrollments, or files",
        );
      }
      this.logger.error(
        `Failed to delete class: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
