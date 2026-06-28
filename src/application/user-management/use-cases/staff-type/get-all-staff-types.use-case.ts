import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export interface GetAllStaffTypesInput {
  campusId: string;
  params: StandardRequest;
}

@Injectable()
export class GetAllStaffTypesUseCase {
  private readonly logger = new Logger(GetAllStaffTypesUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
  ) {}

  async execute(
    input: GetAllStaffTypesInput,
  ): Promise<PaginatedResult<StaffType>> {
    const { campusId, params } = input;

    if (!campusId) {
      throw new BadRequestException(
        "Campus ID is required to fetch staff types",
      );
    }

    this.logger.log(`Getting all staff types for campus ${campusId}`);

    return await this.staffTypeRepository.findAll(params, { campusId });
  }
}
