import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StaffRepository } from "../../ports/staff.repository";

export interface GetStaffByIdInput {
  id: string;
  campusId: string;
}

@Injectable()
export class GetStaffByIdUseCase {
  private readonly logger = new Logger(GetStaffByIdUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
  ) {}

  async execute(input: GetStaffByIdInput): Promise<Staff> {
    const { id, campusId } = input;

    try {
      this.logger.log(`Fetching staff by ID: ${id} in campus ${campusId}`);

      const staff = await this.staffRepository.findById(id);

      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      // Verify staff belongs to the specified campus
      if (staff.campusId !== campusId) {
        throw new NotFoundException(
          `Staff with ID ${id} not found in this campus`,
        );
      }

      this.logger.log(`Found staff: ${staff.fullName}`);
      return staff;
    } catch (error) {
      this.logger.error(`Failed to fetch staff: ${error.message}`, error.stack);
      throw error;
    }
  }
}
