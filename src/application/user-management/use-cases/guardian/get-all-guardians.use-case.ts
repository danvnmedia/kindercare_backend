import { Injectable, Inject, Logger } from "@nestjs/common";
import { GuardianRepository } from "../../ports/guardian.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { Guardian } from "@/domain/user-management/guardian.entity";

@Injectable()
export class GetAllGuardiansUseCase {
  private readonly logger = new Logger(GetAllGuardiansUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
  ) {}

  async execute(params: StandardRequest): Promise<PaginatedResult<Guardian>> {
    try {
      this.logger.log(
        `Fetching guardians: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.guardianRepository.findAll(params);

      this.logger.log(
        `Found ${result.pagination.count} guardians, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch guardians: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
