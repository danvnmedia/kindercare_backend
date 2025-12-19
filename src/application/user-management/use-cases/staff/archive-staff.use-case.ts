import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";
import { IdentityService } from "@/infra/external-services/clerk/identity.service";

@Injectable()
export class ArchiveStaffUseCase {
  private readonly logger = new Logger(ArchiveStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(id: string): Promise<Staff> {
    try {
      this.logger.log(`Archiving staff: ${id}`);

      // Step 1: Find existing staff
      const staff = await this.staffRepository.findById(id);
      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      // Step 2: Archive the staff (soft delete)
      staff.archive();
      const archivedStaff = await this.staffRepository.update(staff);

      // Step 3: Deactivate linked user account if exists
      if (staff.hasUserAccount()) {
        await this.deactivateUserAccount(staff);
      }

      this.logger.log(`Staff archived successfully: ${id}`);
      return archivedStaff;
    } catch (error) {
      this.logger.error(
        `Failed to archive staff: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async deactivateUserAccount(staff: Staff): Promise<void> {
    try {
      const user = await this.userRepository.findById(staff.userId!);
      if (user) {
        user.deactivate();
        await this.userRepository.update(user);
        this.logger.log(
          `User account deactivated for staff: ${staff.email}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to deactivate user account: ${error.message}`,
        error.stack,
      );
      // Don't throw - user deactivation failure shouldn't fail the archive operation
    }
  }
}
