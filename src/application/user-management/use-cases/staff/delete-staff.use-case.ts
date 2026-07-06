import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { StaffRepository } from "../../ports/staff.repository";

/**
 * Delete Staff Use Case (Hard Delete)
 *
 * Permanently deletes only the campus Staff profile. Linked global identity
 * lifecycle is handled by dedicated identity administration.
 *
 * This operation is IRREVERSIBLE. For soft delete (archiving),
 * use ArchiveStaffUseCase instead.
 */
@Injectable()
export class DeleteStaffUseCase {
  private readonly logger = new Logger(DeleteStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
  ) {}

  async execute(id: string, campusId: string): Promise<void> {
    try {
      this.logger.log(`Deleting staff: ${id} in campus ${campusId}`);

      // Step 1: Verify staff exists
      const staff = await this.staffRepository.findById(id);
      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      // Step 2: Verify staff belongs to the specified campus
      if (staff.campusId !== campusId) {
        throw new NotFoundException(
          `Staff with ID ${id} not found in this campus`,
        );
      }

      // Step 3: Delete only the campus Staff profile. Linked global identity
      // lifecycle is handled by dedicated identity administration.
      await this.staffRepository.delete(id);

      this.logger.log(`Staff profile deleted successfully: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete staff: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

}
