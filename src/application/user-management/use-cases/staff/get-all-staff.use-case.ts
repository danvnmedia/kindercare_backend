import { Injectable, Inject, Logger } from "@nestjs/common";
import { StaffRepository } from "../../ports/staff.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { Staff } from "@/domain/user-management/entities/staff.entity";

@Injectable()
export class GetAllStaffUseCase {
  private readonly logger = new Logger(GetAllStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
  ) {}

  async execute(params: StandardRequest): Promise<PaginatedResult<Staff>> {
    try {
      this.logger.log(
        `Fetching staff: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
      );

      const result = await this.staffRepository.findAll(params);

      this.logger.log(
        `Found ${result.pagination.count} staff, returning page ${result.pagination.currentPage}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch staff: ${error.message}`, error.stack);
      throw error;
    }
  }
}
