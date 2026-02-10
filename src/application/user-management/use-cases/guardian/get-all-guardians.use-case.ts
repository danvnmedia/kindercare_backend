import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { GuardianRepository } from "../../ports/guardian.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";

export interface GetAllGuardiansInput {
  campusId: string;
  params: StandardRequest;
}

@Injectable()
export class GetAllGuardiansUseCase {
  private readonly logger = new Logger(GetAllGuardiansUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
  ) {}

  async execute(
    input: GetAllGuardiansInput,
  ): Promise<PaginatedResult<Guardian>> {
    const { campusId, params } = input;

    if (!campusId) {
      throw new BadRequestException("Campus ID is required to fetch guardians");
    }

    try {
      this.logger.log(
        `Fetching guardians for campus ${campusId}: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.guardianRepository.findAll(params, {
        campusId,
      });

      this.logger.log(
        `Found ${result.pagination.count} guardians in campus ${campusId}, returning page ${result.pagination.currentPage}`,
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
