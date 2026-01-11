import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { StaffRepository } from "../../ports/staff.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { Staff } from "@/domain/user-management/entities/staff.entity";

export interface GetAllStaffInput {
  campusId: string;
  params: StandardRequest;
}

@Injectable()
export class GetAllStaffUseCase {
  private readonly logger = new Logger(GetAllStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
  ) {}

  async execute(input: GetAllStaffInput): Promise<PaginatedResult<Staff>> {
    const { campusId, params } = input;

    if (!campusId) {
      throw new BadRequestException("Campus ID is required to fetch staff");
    }

    try {
      this.logger.log(
        `Fetching staff for campus ${campusId}: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
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

      const result = await this.staffRepository.findAll(scopedParams);

      this.logger.log(
        `Found ${result.pagination.count} staff in campus ${campusId}, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch staff: ${error.message}`, error.stack);
      throw error;
    }
  }
}
