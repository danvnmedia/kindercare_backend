import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";

@Injectable()
export class RestoreStaffUseCase {
  private readonly logger = new Logger(RestoreStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async execute(id: string): Promise<Staff> {
    try {
      this.logger.log(`Restoring staff: ${id}`);

      // Step 1: Find existing staff
      const staff = await this.staffRepository.findById(id);
      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      // Step 2: Restore the staff
      staff.restore();
      const restoredStaff = await this.staffRepository.update(staff);

      // Step 3: Reactivate linked user account if exists
      if (staff.hasUserAccount()) {
        await this.reactivateUserAccount(staff);
      }

      this.logger.log(`Staff restored successfully: ${id}`);
      return restoredStaff;
    } catch (error) {
      this.logger.error(
        `Failed to restore staff: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async reactivateUserAccount(staff: Staff): Promise<void> {
    try {
      const user = await this.userRepository.findById(staff.userId!);
      if (user) {
        user.activate();
        await this.userRepository.update(user);
        this.logger.log(`User account reactivated for staff: ${staff.email}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to reactivate user account: ${error.message}`,
        error.stack,
      );
      // Don't throw - user reactivation failure shouldn't fail the restore operation
    }
  }
}
