import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StaffRepository } from "../../ports/staff.repository";

@Injectable()
export class GetStaffByIdUseCase {
  private readonly logger = new Logger(GetStaffByIdUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
  ) {}

  async execute(id: string): Promise<Staff> {
    try {
      this.logger.log(`Fetching staff by ID: ${id}`);

      const staff = await this.staffRepository.findById(id);

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      this.logger.log(`Found staff: ${staff.fullName}`);
      return staff;
    } catch (error) {
      this.logger.error(`Failed to fetch staff: ${error.message}`, error.stack);
      throw error;
    }
  }
}
