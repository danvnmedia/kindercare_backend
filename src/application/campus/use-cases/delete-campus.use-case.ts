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
   * Soft delete campus by deactivating it (isActive = false)
   */
  async execute(id: string): Promise<Campus> {
    try {
      this.logger.log(`Deactivating campus: ${id}`);

      // Find existing campus
      const campus = await this.campusRepository.findById(id);
      if (!campus) {
        throw new NotFoundException(`Campus with ID "${id}" not found`);
      }

      // Check if already inactive
      if (!campus.isActive) {
        this.logger.log(`Campus ${id} is already inactive`);
        return campus;
      }

      // Deactivate the campus (soft delete)
      campus.deactivate();

      // Save to repository
      const deactivatedCampus = await this.campusRepository.update(campus);
      this.logger.log(`Campus deactivated: ${deactivatedCampus.id}`);

      return deactivatedCampus;
    } catch (error) {
      this.logger.error(
        `Failed to deactivate campus: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
