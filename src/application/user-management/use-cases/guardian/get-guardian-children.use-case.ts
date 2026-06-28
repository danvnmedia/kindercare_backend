import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { GuardianRepository } from "../../ports/guardian.repository";
import { GuardianStudent } from "@/domain/user-management/entities/guardian.entity";

@Injectable()
export class GetGuardianChildrenUseCase {
  private readonly logger = new Logger(GetGuardianChildrenUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
  ) {}

  async execute(
    guardianId: string,
    campusId?: string,
  ): Promise<GuardianStudent[]> {
    try {
      this.logger.log(`Getting children for guardian ${guardianId}`);

      const guardian = await this.guardianRepository.findById(guardianId);
      if (!guardian) {
        throw new NotFoundException(`Guardian with ID ${guardianId} not found`);
      }

      if (campusId && guardian.campusId !== campusId) {
        throw new NotFoundException(
          `Guardian with ID ${guardianId} not found in this campus`,
        );
      }

      const children =
        await this.guardianRepository.getGuardianChildren(guardianId);

      this.logger.log(
        `Found ${children.length} children for guardian ${guardianId}`,
      );

      return children;
    } catch (error) {
      this.logger.error(
        `Failed to get guardian children: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
