import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import {
  Staff,
  UpdateStaffData,
} from "@/domain/user-management/entities/staff.entity";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";
import { RoleRepository } from "../../ports/role.repository";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";

export interface UpdateStaffInput extends UpdateStaffData {
  staffType?: StaffType;
}

@Injectable()
export class UpdateStaffUseCase {
  private readonly logger = new Logger(UpdateStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, input: UpdateStaffInput): Promise<Staff> {
    try {
      this.logger.log(`Updating staff: ${id}`);

      // Step 1: Find existing staff
      const staff = await this.staffRepository.findById(id);
      if (!staff) {
        throw new NotFoundException(`Staff with ID ${id} not found`);
      }

      const oldStaffType = staff.staffType;

      // Step 2: Update staff profile
      staff.updateProfile(input);

      // Step 3: If staffType changed, update user role
      if (input.staffType && input.staffType !== oldStaffType) {
        staff.changeType(input.staffType);
        await this.updateUserRole(staff, oldStaffType, input.staffType);
      }

      // Step 4: Save updated staff
      const updatedStaff = await this.staffRepository.update(staff);

      this.logger.log(`Staff updated successfully: ${id}`);
      return updatedStaff;
    } catch (error) {
      this.logger.error(
        `Failed to update staff: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateUserRole(
    staff: Staff,
    oldType: StaffType,
    newType: StaffType,
  ): Promise<void> {
    if (!staff.hasUserAccount()) {
      this.logger.log("Staff has no user account, skipping role update");
      return;
    }

    try {
      const oldRoleId = Staff.getStaffRoleId(oldType);
      const newRoleId = Staff.getStaffRoleId(newType);

      // Verify new role exists
      const newRole = await this.roleRepository.findById(newRoleId);
      if (!newRole) {
        this.logger.warn(
          `New role ${newRoleId} not found, skipping role update`,
        );
        return;
      }

      // Remove old role
      await this.userRepository.removeRoles(staff.userId!, [oldRoleId]);
      this.logger.log(`Removed role ${oldRoleId} from user ${staff.userId}`);

      // Assign new role
      await this.userRepository.assignRoles(staff.userId!, [newRoleId]);
      this.logger.log(`Assigned role ${newRoleId} to user ${staff.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update user role: ${error.message}`,
        error.stack,
      );
      // Don't throw - role update failure shouldn't fail the entire update
    }
  }
}
