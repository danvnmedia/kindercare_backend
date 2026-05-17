import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { SchoolYearRepository } from "../../ports/school-year.repository";

@Injectable()
export class GetSchoolYearByIdUseCase {
  private readonly logger = new Logger(GetSchoolYearByIdUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
  ) {}

  async execute(id: string, campusId?: string): Promise<SchoolYear> {
    this.logger.log(`Getting school year by ID: ${id}`);

    const schoolYear = await this.schoolYearRepository.findById(id);
    if (!schoolYear) {
      throw new NotFoundException(`School year with ID ${id} not found`);
    }

    if (campusId && schoolYear.campusId !== campusId) {
      throw new NotFoundException(
        `School year with ID ${id} not found in this campus`,
      );
    }

    return schoolYear;
  }
}
