import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";

@Injectable()
export class GetStaffClassesUseCase {
  private readonly logger = new Logger(GetStaffClassesUseCase.name);

  constructor(
    @Inject("CLASS_STAFF_REPOSITORY")
    private readonly classStaffRepository: ClassStaffRepository,
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
  ) {}

  async execute(staffId: string): Promise<ClassStaff[]> {
    try {
      this.logger.log(`Fetching classes for staff: ${staffId}`);

      // Validate staff exists
      const staff = await this.staffRepository.findById(staffId);
      if (!staff) {
        throw new NotFoundException(`Staff with ID ${staffId} not found`);
      }

      const assignments =
        await this.classStaffRepository.findByStaffId(staffId);

      this.logger.log(
        `Found ${assignments.length} class assignments for staff ${staffId}`,
      );

      return assignments;
    } catch (error) {
      this.logger.error(
        `Failed to fetch staff classes: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
