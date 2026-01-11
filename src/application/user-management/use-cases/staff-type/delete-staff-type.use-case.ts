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
   * Soft delete staff type by deactivating it (isActive = false)
   */
  async execute(id: string): Promise<StaffType> {
    try {
      this.logger.log(`Deactivating staff type: ${id}`);

      // Find existing staff type
      const staffType = await this.staffTypeRepository.findById(id);
      if (!staffType) {
        throw new NotFoundException(`Staff type with ID "${id}" not found`);
      }

      // Check if already inactive
      if (!staffType.isActive) {
        this.logger.log(`Staff type ${id} is already inactive`);
        return staffType;
      }

      // Deactivate the staff type (soft delete)
      staffType.deactivate();

      // Save to repository
      const deactivatedStaffType =
        await this.staffTypeRepository.update(staffType);
      this.logger.log(`Staff type deactivated: ${deactivatedStaffType.id}`);

      return deactivatedStaffType;
    } catch (error) {
      this.logger.error(
        `Failed to deactivate staff type: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
