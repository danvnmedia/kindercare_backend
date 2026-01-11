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

      // Inject campusId filter to ensure campus scoping
      // Parse existing filter string if present, add campusId, and re-stringify
      let existingFilter: Record<string, unknown> = {};
      if (params.filter) {
        try {
          existingFilter = JSON.parse(params.filter);
        } catch {
          // If filter is invalid JSON, ignore it
          this.logger.warn(`Invalid filter JSON: ${params.filter}`);
        }
      }

      const scopedFilter = {
        ...existingFilter,
        campusId: { eq: campusId },
      };

      const scopedParams: StandardRequest = {
        ...params,
        filter: JSON.stringify(scopedFilter),
      };

      const result = await this.guardianRepository.findAll(scopedParams);

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
