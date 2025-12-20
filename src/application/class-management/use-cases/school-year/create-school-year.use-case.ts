import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { SchoolYearRepository } from "../../ports/school-year.repository";

export interface CreateSchoolYearInput {
  name: string;
  startDate: Date;
  endDate: Date;
  isArchived?: boolean;
}

@Injectable()
export class CreateSchoolYearUseCase {
  private readonly logger = new Logger(CreateSchoolYearUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
  ) {}

  async execute(input: CreateSchoolYearInput): Promise<SchoolYear> {
    try {
      this.logger.log(`Creating school year: ${input.name}`);

      // Step 1: Check for duplicate name
      const existingSchoolYear = await this.schoolYearRepository.findByName(
        input.name,
      );
      if (existingSchoolYear) {
        throw new ConflictException(
          `School year "${input.name}" already exists`,
        );
      }

      // Step 2: Create domain entity (validation happens in factory)
      const schoolYear = SchoolYear.create({
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        isArchived: input.isArchived ?? true,
      });

      // Step 3: Save to repository
      const savedSchoolYear = await this.schoolYearRepository.save(schoolYear);
      this.logger.log(`School year created: ${savedSchoolYear.id}`);

      return savedSchoolYear;
    } catch (error) {
      this.logger.error(
        `Failed to create school year: ${error.message}`,
        error.stack,
      );
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
