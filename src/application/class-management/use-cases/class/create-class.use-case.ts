import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ClassRepository } from "../../ports/class.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";

export interface CreateClassInput {
  name: string;
  description?: string;
  gradeLevelId: string;
  schoolYearId: string;
}

@Injectable()
export class CreateClassUseCase {
  private readonly logger = new Logger(CreateClassUseCase.name);

  constructor(
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
  ) {}

  async execute(input: CreateClassInput): Promise<Class> {
    try {
      this.logger.log(`Creating class: ${input.name}`);

      // Step 1: Validate grade level exists
      const gradeLevel = await this.gradeLevelRepository.findById(
        input.gradeLevelId,
      );
      if (!gradeLevel) {
        throw new NotFoundException(
          `Grade level with ID ${input.gradeLevelId} not found`,
        );
      }

      // Step 2: Validate school year exists
      const schoolYear = await this.schoolYearRepository.findById(
        input.schoolYearId,
      );
      if (!schoolYear) {
        throw new NotFoundException(
          `School year with ID ${input.schoolYearId} not found`,
        );
      }

      // Step 3: Check for duplicate class name in the same context
      const existingClass = await this.classRepository.findByNameInContext(
        input.name,
        input.schoolYearId,
        input.gradeLevelId,
      );
      if (existingClass) {
        throw new ConflictException(
          `Class "${input.name}" already exists in this grade level and school year`,
        );
      }

      // Step 4: Create and save class
      const classEntity = Class.create({
        name: input.name,
        description: input.description || null,
        gradeLevelId: input.gradeLevelId,
        schoolYearId: input.schoolYearId,
      });

      const savedClass = await this.classRepository.save(classEntity);
      this.logger.log(`Class created: ${savedClass.id}`);

      return savedClass;
    } catch (error) {
      this.logger.error(
        `Failed to create class: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
