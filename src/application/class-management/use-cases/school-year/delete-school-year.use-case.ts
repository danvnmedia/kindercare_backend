import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { ClassRepository } from "../../ports/class.repository";

@Injectable()
export class DeleteSchoolYearUseCase {
  private readonly logger = new Logger(DeleteSchoolYearUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting school year: ${id}`);

      // Step 1: Find existing school year
      const schoolYear = await this.schoolYearRepository.findById(id);
      if (!schoolYear) {
        throw new NotFoundException(`School year with ID ${id} not found`);
      }

      // Step 2: Check for dependent classes
      const dependentClasses =
        await this.classRepository.findBySchoolYearId(id);
      if (dependentClasses.length > 0) {
        throw new ConflictException(
          `Cannot delete school year: ${dependentClasses.length} class(es) are associated with it`,
        );
      }

      // Step 3: Delete school year
      await this.schoolYearRepository.delete(id);

      this.logger.log(`School year deleted successfully: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete school year: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
