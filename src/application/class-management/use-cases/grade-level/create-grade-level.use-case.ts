import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { GradeLevelRepository } from "../../ports/grade-level.repository";

export interface CreateGradeLevelInput {
  name: string;
  order?: number;
  isArchived?: boolean;
}

@Injectable()
export class CreateGradeLevelUseCase {
  private readonly logger = new Logger(CreateGradeLevelUseCase.name);

  constructor(
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(input: CreateGradeLevelInput): Promise<GradeLevel> {
    try {
      this.logger.log(`Creating grade level: ${input.name}`);

      // Step 1: Check for duplicate name
      const existingByName = await this.gradeLevelRepository.findByName(
        input.name,
      );
      if (existingByName) {
        throw new ConflictException(
          `Grade level "${input.name}" already exists`,
        );
      }

      // Step 2: Determine order value (auto-calculate if not provided)
      let order: number;
      if (input.order !== undefined) {
        // Check for duplicate order if explicitly provided
        const existingByOrder = await this.gradeLevelRepository.findByOrder(
          input.order,
        );
        if (existingByOrder) {
          throw new ConflictException(
            `Grade level with order ${input.order} already exists`,
          );
        }
        order = input.order;
      } else {
        // Auto-calculate: next order after the current maximum
        const maxOrder = await this.gradeLevelRepository.getMaxOrder();
        order = maxOrder + 1;
        this.logger.log(`Auto-assigned order: ${order}`);
      }

      // Step 3: Create domain entity (validation happens in factory)
      const gradeLevel = GradeLevel.create({
        name: input.name,
        order,
        isArchived: input.isArchived ?? false,
      });

      // Step 4: Save to repository
      const savedGradeLevel = await this.gradeLevelRepository.save(gradeLevel);
      this.logger.log(`Grade level created: ${savedGradeLevel.id}`);

      return savedGradeLevel;
    } catch (error) {
      this.logger.error(
        `Failed to create grade level: ${error.message}`,
        error.stack,
      );
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
