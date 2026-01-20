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

      const result = await this.staffRepository.findAll(params, { campusId });

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
