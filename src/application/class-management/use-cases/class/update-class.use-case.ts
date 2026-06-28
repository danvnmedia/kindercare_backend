import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import {
  Class,
  UpdateClassData,
} from "@/domain/class-management/entities/class.entity";
import { ClassRepository } from "../../ports/class.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";

@Injectable()
export class UpdateClassUseCase {
  private readonly logger = new Logger(UpdateClassUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(id: string, input: UpdateClassData): Promise<Class> {
    try {
      this.logger.log(`Updating class: ${id}`);

      // Step 1: Find existing class
      const classEntity = await this.classRepository.findById(id);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${id} not found`);
      }

      // Step 2: Validate grade level if being changed
      if (
        input.gradeLevelId &&
        input.gradeLevelId !== classEntity.gradeLevelId
      ) {
        const gradeLevel = await this.gradeLevelRepository.findById(
          input.gradeLevelId,
        );
        if (!gradeLevel) {
          throw new NotFoundException(
            `Grade level with ID ${input.gradeLevelId} not found`,
          );
        }
        if (gradeLevel.campusId !== classEntity.campusId) {
          throw new BadRequestException(
            `Grade level does not belong to the specified campus`,
          );
        }
      }

      // Step 3: Check uniqueness if name or gradeLevelId is changing
      const effectiveName =
        input.name && input.name.trim() !== classEntity.name
          ? input.name
          : classEntity.name;
      const effectiveGradeLevelId =
        input.gradeLevelId && input.gradeLevelId !== classEntity.gradeLevelId
          ? input.gradeLevelId
          : classEntity.gradeLevelId;

      const nameChanging =
        input.name !== undefined && input.name.trim() !== classEntity.name;
      const gradeLevelChanging =
        input.gradeLevelId !== undefined &&
        input.gradeLevelId !== classEntity.gradeLevelId;

      if (nameChanging || gradeLevelChanging) {
        const existingClass =
          await this.classRepository.findByNameInContextAndCampus(
            effectiveName,
            classEntity.campusId,
            classEntity.schoolYearId,
            effectiveGradeLevelId,
          );
        if (existingClass && existingClass.id !== id) {
          throw new ConflictException(
            `Class "${effectiveName}" already exists in this grade level and school year`,
          );
        }
      }

      // Step 4: Update class
      classEntity.update(input);

      // Step 5: Save updated class
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
