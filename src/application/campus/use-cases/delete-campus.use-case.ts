import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { CampusRepository } from "../ports/campus.repository";

@Injectable()
export class DeleteCampusUseCase {
  private readonly logger = new Logger(DeleteCampusUseCase.name);

  constructor(
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  /**
   * Soft delete campus by archiving it (isArchived = true)
   */
  async execute(id: string): Promise<Campus> {
    try {
      this.logger.log(`Archiving campus: ${id}`);

      // Find existing campus
      const campus = await this.campusRepository.findById(id);
      if (!campus) {
        throw new NotFoundException(`Campus with ID "${id}" not found`);
      }

      // Check if already archived
      if (campus.isArchived) {
        this.logger.log(`Campus ${id} is already archived`);
        return campus;
      }

      // Archive the campus (soft delete)
      campus.archive();

      // Save to repository
      const archivedCampus = await this.campusRepository.update(campus);
      this.logger.log(`Campus archived: ${archivedCampus.id}`);

      return archivedCampus;
    } catch (error) {
      this.logger.error(
        `Failed to archive campus: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
