import { Injectable, Inject, Logger } from "@nestjs/common";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

@Injectable()
export class GetAllStaffTypesUseCase {
  private readonly logger = new Logger(GetAllStaffTypesUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
  ) {}

  async execute(params: StandardRequest): Promise<PaginatedResult<StaffType>> {
    this.logger.log("Getting all staff types");

    return await this.staffTypeRepository.findAll(params);
  }
}
