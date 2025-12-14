import { Injectable, Inject, Logger } from "@nestjs/common";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";

@Injectable()
export class GetAllSchoolYearsUseCase {
  private readonly logger = new Logger(GetAllSchoolYearsUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
  ) {}

  async execute(): Promise<SchoolYear[]> {
    try {
      this.logger.log("Fetching all school years");

      const result = await this.schoolYearRepository.findAll();

      this.logger.log(`Found ${result.length} school years`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch school years: ${error.message}`, error.stack);
      throw error;
    }
  }
}
