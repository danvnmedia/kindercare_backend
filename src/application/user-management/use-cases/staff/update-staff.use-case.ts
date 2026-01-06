import { IdentityPort } from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  Staff,
  UpdateStaffData,
} from "@/domain/user-management/entities/staff.entity";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { RoleRepository } from "../../ports/role.repository";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";

export interface UpdateStaffInput extends UpdateStaffData {
  staffType?: StaffType;
}

interface ClerkChanges {
  hasChanges: boolean;
  fullName?: string;
}

interface ClerkOriginalValues {
  fullName: string;
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
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(id: string, input: UpdateStaffInput): Promise<Staff> {
    this.logger.log(`Updating staff: ${id}`);

    // Step 1: Find existing staff
    const staff = await this.staffRepository.findById(id);
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    // Step 2: Detect Clerk-relevant changes (only fullName for staff)
    const clerkChanges = this.detectClerkChanges(staff, input);

    // Step 3: If has User account AND has Clerk changes -> Saga pattern
    if (staff.userId && clerkChanges.hasChanges) {
      return await this.updateWithClerkSync(staff, input, clerkChanges);
    }

    // Step 4: Otherwise, just update DB with transaction
    return await this.updateDbOnly(staff, input);
  }

  /**
   * Detect which fields need to be synced with Clerk
   * For Staff, only fullName is synced (email/phone excluded from updates per UpdateStaffData)
   */
  private detectClerkChanges(
    staff: Staff,
    input: UpdateStaffInput,
  ): ClerkChanges {
    const changes: ClerkChanges = { hasChanges: false };

    if (input.fullName !== undefined && input.fullName !== staff.fullName) {
      changes.fullName = input.fullName;
      changes.hasChanges = true;
    }

    return changes;
  }

  /**
   * Update with Clerk sync using Saga pattern
   * Flow: Clerk first -> DB transaction -> Revert Clerk on failure
   */
  private async updateWithClerkSync(
    staff: Staff,
    input: UpdateStaffInput,
    clerkChanges: ClerkChanges,
  ): Promise<Staff> {
    // Get User to find clerkUid
    const user = await this.userRepository.findById(staff.userId!);
    if (!user) {
      this.logger.warn(
        `User not found for staff ${staff.id}, falling back to DB-only update`,
      );
      return await this.updateDbOnly(staff, input);
    }

    // Store original values for potential rollback
    const originalValues: ClerkOriginalValues = {
      fullName: staff.fullName,
    };

    const oldStaffType = staff.staffType;

    this.logger.log(
      `Updating Clerk user ${user.clerkUid} for staff ${staff.id}`,
    );

    // Update Clerk FIRST (external service)
    try {
      await this.identityPort.updateUser(user.clerkUid, {
        fullName: clerkChanges.fullName,
      });
      this.logger.log(`Clerk user updated successfully: ${user.clerkUid}`);
    } catch (clerkError) {
      this.logger.error(
        `Failed to update Clerk user: ${clerkError.message}`,
        clerkError.stack,
      );
      throw new BadRequestException(
        `Failed to update identity: ${clerkError.message}`,
      );
    }

    try {
      // Update DB in transaction using UnitOfWork
      staff.updateProfile(input);

      // Handle staffType change
      if (input.staffType && input.staffType !== oldStaffType) {
        staff.changeType(input.staffType);
      }

      const updatedStaff = await this.unitOfWork.run(async (tx) => {
        // Update staff in transaction
        await tx.updateStaff(staff.id, {
          fullName: staff.fullName,
          staffType: staff.staffType,
          address: staff.address,
          dateOfBirth: staff.dateOfBirth,
          gender: staff.gender,
          startDate: staff.startDate,
          isArchived: staff.isArchived,
          updatedAt: staff.updatedAt,
        });

        // Handle role update inside transaction if staffType changed
        if (input.staffType && input.staffType !== oldStaffType) {
          await this.updateUserRoleInTransaction(
            tx,
            staff,
            oldStaffType,
            input.staffType,
          );
        }

        this.logger.log(`Staff updated in DB: ${staff.id}`);
        return staff;
      });

      this.logger.log(`Staff updated successfully: ${staff.id}`);
      return updatedStaff;
    } catch (dbError) {
      // Compensate: Revert Clerk to original values
      this.logger.error(
        `DB transaction failed, compensating by reverting Clerk: ${user.clerkUid}`,
      );
      await this.revertClerkChanges(
        user.clerkUid,
        originalValues,
        clerkChanges,
      );

      this.logger.error(
        `Failed to update staff: ${dbError.message}`,
        dbError.stack,
      );
      throw new BadRequestException(
        `Failed to update staff: ${dbError.message}`,
      );
    }
  }

  /**
   * Update DB only (no Clerk sync needed)
   */
  private async updateDbOnly(
    staff: Staff,
    input: UpdateStaffInput,
  ): Promise<Staff> {
    const oldStaffType = staff.staffType;

    try {
      staff.updateProfile(input);

      // Handle staffType change
      if (input.staffType && input.staffType !== oldStaffType) {
        staff.changeType(input.staffType);
      }

      const updatedStaff = await this.unitOfWork.run(async (tx) => {
        // Update staff in transaction
        await tx.updateStaff(staff.id, {
          fullName: staff.fullName,
          staffType: staff.staffType,
          address: staff.address,
          dateOfBirth: staff.dateOfBirth,
          gender: staff.gender,
          startDate: staff.startDate,
          isArchived: staff.isArchived,
          updatedAt: staff.updatedAt,
        });

        // Handle role update inside transaction if staffType changed
        if (input.staffType && input.staffType !== oldStaffType) {
          await this.updateUserRoleInTransaction(
            tx,
            staff,
            oldStaffType,
            input.staffType,
          );
        }

        this.logger.log(`Staff updated (DB only): ${staff.id}`);
        return staff;
      });

      return updatedStaff;
    } catch (error) {
      this.logger.error(
        `Failed to update staff: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update user role within transaction context
   */
  private async updateUserRoleInTransaction(
    tx: Parameters<Parameters<UnitOfWorkPort["run"]>[0]>[0],
    staff: Staff,
    oldType: StaffType,
    newType: StaffType,
  ): Promise<void> {
    if (!staff.hasUserAccount()) {
      this.logger.log("Staff has no user account, skipping role update");
      return;
    }

    const oldRoleId = Staff.getStaffRoleId(oldType);
    const newRoleId = Staff.getStaffRoleId(newType);

    // Verify new role exists
    const newRole = await this.roleRepository.findById(newRoleId);
    if (!newRole) {
      throw new BadRequestException(
        `Role ${newRoleId} not found, cannot update staff type`,
      );
    }

    // Remove old role
    await this.userRepository.removeRoles(staff.userId!, [oldRoleId]);
    this.logger.log(`Removed role ${oldRoleId} from user ${staff.userId}`);

    // Assign new role using transaction context
    await tx.assignRoles(staff.userId!, [newRoleId]);
    this.logger.log(`Assigned role ${newRoleId} to user ${staff.userId}`);
  }

  /**
   * Compensation: Revert Clerk changes to original values
   */
  private async revertClerkChanges(
    clerkUid: string,
    originalValues: ClerkOriginalValues,
    appliedChanges: ClerkChanges,
  ): Promise<void> {
    try {
      const revertData: { fullName?: string } = {};

      // Only revert fields that were actually changed
      if (appliedChanges.fullName !== undefined) {
        revertData.fullName = originalValues.fullName;
      }

      await this.identityPort.updateUser(clerkUid, revertData);
      this.logger.log(
        `Compensation successful: Clerk reverted for ${clerkUid}`,
      );
    } catch (compensationError) {
      // Log but don't throw - compensation is best effort
      this.logger.error(
        `Compensation FAILED: Could not revert Clerk user ${clerkUid}. Manual fix required.`,
        compensationError.stack,
      );
    }
  }
}
