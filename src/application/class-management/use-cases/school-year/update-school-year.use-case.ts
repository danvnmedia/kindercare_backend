import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import {
  SchoolYear,
  UpdateSchoolYearData,
} from "@/domain/class-management/entities/school-year.entity";
import { SchoolYearRepository } from "../../ports/school-year.repository";

@Injectable()
export class UpdateSchoolYearUseCase {
  private readonly logger = new Logger(UpdateSchoolYearUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
  ) {}

  async execute(id: string, input: UpdateSchoolYearData): Promise<SchoolYear> {
    try {
      this.logger.log(`Updating school year: ${id}`);

      // Step 1: Find existing school year
      const schoolYear = await this.schoolYearRepository.findById(id);
      if (!schoolYear) {
        throw new NotFoundException(`School year with ID ${id} not found`);
      }

      // Step 2: Check for name uniqueness if name is being updated
      if (input.name && input.name !== schoolYear.name) {
        const existingByName = await this.schoolYearRepository.findByName(
          input.name,
        );
        if (existingByName) {
          throw new ConflictException(
            `School year "${input.name}" already exists`,
          );
        }
      }

      // Step 3: Update school year (validation happens in entity method)
      schoolYear.update(input);

      // Step 4: Save updated school year
      const updatedSchoolYear =
        await this.schoolYearRepository.update(schoolYear);

      this.logger.log(`School year updated successfully: ${id}`);
      return updatedSchoolYear;
    } catch (error) {
      this.logger.error(
        `Failed to update school year: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
