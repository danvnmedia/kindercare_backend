import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { GuardianRepository } from "../../ports/guardian.repository";

@Injectable()
export class DeleteGuardianUseCase {
  private readonly logger = new Logger(DeleteGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
  ) {}

  async execute(id: string, campusId?: string): Promise<void> {
    try {
      this.logger.log(`Deleting guardian: ${id}`);

      // Step 1: Verify guardian exists
      const guardian = await this.guardianRepository.findById(id);
      if (!guardian) {
        throw new NotFoundException(`Guardian with ID ${id} not found`);
      }

      // Step 2: Verify guardian belongs to the specified campus (if campusId provided)
      if (campusId && guardian.campusId !== campusId) {
        throw new NotFoundException(
          `Guardian with ID ${id} not found in this campus`,
        );
      }

      // Step 3: Delete only the campus Guardian profile. Linked global
      // identity lifecycle is handled by dedicated identity administration.
      await this.guardianRepository.delete(id);

      this.logger.log(`Guardian profile deleted successfully: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete guardian: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

}
