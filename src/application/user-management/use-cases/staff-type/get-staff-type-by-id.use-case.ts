import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";

@Injectable()
export class GetStaffTypeByIdUseCase {
  private readonly logger = new Logger(GetStaffTypeByIdUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
  ) {}

  async execute(id: string): Promise<StaffType> {
    this.logger.log(`Getting staff type by ID: ${id}`);

    const staffType = await this.staffTypeRepository.findById(id);

    if (!staffType) {
      throw new NotFoundException(`Staff type with ID "${id}" not found`);
    }

    return staffType;
  }
}
