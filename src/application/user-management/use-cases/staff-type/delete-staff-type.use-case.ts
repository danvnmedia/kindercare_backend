import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";

@Injectable()
export class DeleteStaffTypeUseCase {
  private readonly logger = new Logger(DeleteStaffTypeUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
  ) {}

  /**
   * Soft delete staff type by archiving it (isArchived = true)
   */
  async execute(id: string): Promise<StaffType> {
    try {
      this.logger.log(`Archiving staff type: ${id}`);

      // Find existing staff type
      const staffType = await this.staffTypeRepository.findById(id);
      if (!staffType) {
        throw new NotFoundException(`Staff type with ID "${id}" not found`);
      }

      // Check if already archived
      if (staffType.isArchived) {
        this.logger.log(`Staff type ${id} is already archived`);
        return staffType;
      }

      // Archive the staff type (soft delete)
      staffType.archive();

      // Save to repository
      const archivedStaffType =
        await this.staffTypeRepository.update(staffType);
      this.logger.log(`Staff type archived: ${archivedStaffType.id}`);

      return archivedStaffType;
    } catch (error) {
      this.logger.error(
        `Failed to archive staff type: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
