import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { GuardianRepository } from "../../ports/guardian.repository";

@Injectable()
export class GetGuardianByIdUseCase {
  private readonly logger = new Logger(GetGuardianByIdUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
  ) {}

  async execute(id: string): Promise<Guardian> {
    try {
      this.logger.log(`Fetching guardian by ID: ${id}`);

      const guardian = await this.guardianRepository.findById(id);

      if (!guardian) {
        throw new NotFoundException(`Guardian with ID ${id} not found`);
      }

      this.logger.log(`Found guardian: ${guardian.fullName}`);
      return guardian;
    } catch (error) {
      this.logger.error(
        `Failed to fetch guardian: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
