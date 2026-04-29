import { IdentityPort } from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  Staff,
  UpdateStaffData,
} from "@/domain/user-management/entities/staff.entity";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { RoleRepository } from "../../ports/role.repository";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { UserRepository } from "../../ports/user.repository";

export interface UpdateStaffInput extends UpdateStaffData {
  campusId: string; // Required for campus verification
  staffTypeId?: string | null;
}

interface ClerkChanges {
  hasChanges: boolean;
  email?: string;
  phoneNumber?: string;
  fullName?: string;
}

interface ClerkOriginalValues {
  email: string;
  phoneNumber: string;
  fullName: string;
}

@Injectable()
export class UpdateStaffUseCase {
  private readonly logger = new Logger(UpdateStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(id: string, input: UpdateStaffInput): Promise<Staff> {
    this.logger.log(`Updating staff: ${id} in campus ${input.campusId}`);

    // Step 1: Find existing staff
    const staff = await this.staffRepository.findById(id);
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    // Step 2: Verify staff belongs to the specified campus
    if (staff.campusId !== input.campusId) {
      throw new NotFoundException(
        `Staff with ID ${id} not found in this campus`,
      );
    }

    // Step 3: Check uniqueness (email and phone) - campus-scoped
    if (input.email && input.email !== staff.email) {
      await this.checkEmailUniqueness(staff.campusId, input.email, id);
    }
    if (input.phoneNumber && input.phoneNumber !== staff.phoneNumber) {
      await this.checkPhoneUniqueness(staff.campusId, input.phoneNumber, id);
    }

    // Step 4: Validate new staffTypeId if provided
    let newDefaultRoleId: string | null = null;
    if (
      input.staffTypeId !== undefined &&
      input.staffTypeId !== staff.staffTypeId
    ) {
      if (input.staffTypeId !== null) {
        const newStaffType = await this.staffTypeRepository.findById(
          input.staffTypeId,
        );
        if (!newStaffType) {
          throw new NotFoundException(
            `Staff type with ID ${input.staffTypeId} not found`,
          );
        }
        if (newStaffType.isArchived) {
          throw new BadRequestException(
            `Staff type ${newStaffType.name} is archived`,
          );
        }
        if (newStaffType.campusId !== staff.campusId) {
          throw new BadRequestException(
            `Staff type ${newStaffType.name} does not belong to staff's campus`,
          );
        }
        newDefaultRoleId = newStaffType.defaultRoleId;
        this.logger.log(
          `New staff type validated: ${newStaffType.name}, defaultRoleId: ${newDefaultRoleId}`,
        );
      }
    }

    // Step 5: Detect Clerk-relevant changes (email, phone, fullName)
    const clerkChanges = this.detectClerkChanges(staff, input);

    // Step 6: If has User account AND has Clerk changes -> Saga pattern
    if (staff.userId && clerkChanges.hasChanges) {
      return await this.updateWithClerkSync(
        staff,
        input,
        clerkChanges,
        newDefaultRoleId,
      );
    }

    // Step 7: Otherwise, just update DB with transaction
    return await this.updateDbOnly(staff, input, newDefaultRoleId);
  }

  /**
   * Detect which fields need to be synced with Clerk
   */
  private detectClerkChanges(
    staff: Staff,
    input: UpdateStaffInput,
  ): ClerkChanges {
    const changes: ClerkChanges = { hasChanges: false };

    if (input.email !== undefined && input.email !== staff.email) {
      changes.email = input.email;
      changes.hasChanges = true;
    }
    if (
      input.phoneNumber !== undefined &&
      input.phoneNumber !== staff.phoneNumber
    ) {
      changes.phoneNumber = input.phoneNumber;
      changes.hasChanges = true;
    }
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
    newDefaultRoleId: string | null,
  ): Promise<Staff> {
    // Get User to find clerkUid
    const user = await this.userRepository.findById(staff.userId!);
    if (!user) {
      this.logger.warn(
        `User not found for staff ${staff.id}, falling back to DB-only update`,
      );
      return await this.updateDbOnly(staff, input, newDefaultRoleId);
    }

    // Store original values for potential rollback
    const originalValues: ClerkOriginalValues = {
      email: staff.email,
      phoneNumber: staff.phoneNumber,
      fullName: staff.fullName,
    };

    const oldStaffTypeId = staff.staffTypeId;

    this.logger.log(
      `Updating Clerk user ${user.clerkUid} for staff ${staff.id}`,
    );

    // Update Clerk FIRST (external service)
    try {
      await this.identityPort.updateUser(user.clerkUid, {
        email: clerkChanges.email,
        phoneNumber: clerkChanges.phoneNumber,
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

      // Handle staffTypeId change
      if (
        input.staffTypeId !== undefined &&
        input.staffTypeId !== oldStaffTypeId
      ) {
        staff.changeStaffType(input.staffTypeId);
      }

      const updatedStaff = await this.unitOfWork.run(async (tx) => {
        // Update staff in transaction
        await tx.updateStaff(staff.id, {
          fullName: staff.fullName,
          email: staff.email,
          phoneNumber: staff.phoneNumber,
          staffTypeId: staff.staffTypeId,
          address: staff.address,
          dateOfBirth: staff.dateOfBirth,
          gender: staff.gender,
          startDate: staff.startDate,
          isArchived: staff.isArchived,
          updatedAt: staff.updatedAt,
        });

        // Handle role update inside transaction if staffTypeId changed and new type has default role
        if (
          input.staffTypeId !== undefined &&
          input.staffTypeId !== oldStaffTypeId &&
          newDefaultRoleId
        ) {
          await this.assignDefaultRole(tx, staff, newDefaultRoleId);
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
    newDefaultRoleId: string | null,
  ): Promise<Staff> {
    const oldStaffTypeId = staff.staffTypeId;

    try {
      staff.updateProfile(input);

      // Handle staffTypeId change
      if (
        input.staffTypeId !== undefined &&
        input.staffTypeId !== oldStaffTypeId
      ) {
        staff.changeStaffType(input.staffTypeId);
      }

      const updatedStaff = await this.unitOfWork.run(async (tx) => {
        // Update staff in transaction
        await tx.updateStaff(staff.id, {
          fullName: staff.fullName,
          email: staff.email,
          phoneNumber: staff.phoneNumber,
          staffTypeId: staff.staffTypeId,
          address: staff.address,
          dateOfBirth: staff.dateOfBirth,
          gender: staff.gender,
          startDate: staff.startDate,
          isArchived: staff.isArchived,
          updatedAt: staff.updatedAt,
        });

        // Handle role update inside transaction if staffTypeId changed and new type has default role
        if (
          input.staffTypeId !== undefined &&
          input.staffTypeId !== oldStaffTypeId &&
          newDefaultRoleId
        ) {
          await this.assignDefaultRole(tx, staff, newDefaultRoleId);
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
   * Assign default role from new staff type within transaction context
   * Role is scoped to the staff's campus
   */
  private async assignDefaultRole(
    tx: Parameters<Parameters<UnitOfWorkPort["run"]>[0]>[0],
    staff: Staff,
    newDefaultRoleId: string,
  ): Promise<void> {
    if (!staff.hasUserAccount()) {
      this.logger.log("Staff has no user account, skipping role assignment");
      return;
    }

    // Verify new role exists
    const newRole = await this.roleRepository.findById(newDefaultRoleId);
    if (!newRole) {
      this.logger.warn(
        `Default role ${newDefaultRoleId} not found, skipping role assignment`,
      );
      return;
    }

    // Assign new default role using transaction context, scoped to staff's campus
    await tx.assignRoles(staff.userId!, [
      { roleId: newDefaultRoleId, campusId: staff.campusId },
    ]);
    this.logger.log(
      `Assigned default role ${newDefaultRoleId} to user ${staff.userId} in campus ${staff.campusId}`,
    );
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
      const revertData: {
        email?: string;
        phoneNumber?: string;
        fullName?: string;
      } = {};

      // Only revert fields that were actually changed
      if (appliedChanges.email !== undefined) {
        revertData.email = originalValues.email;
      }
      if (appliedChanges.phoneNumber !== undefined) {
        revertData.phoneNumber = originalValues.phoneNumber;
      }
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

  private async checkEmailUniqueness(
    campusId: string,
    email: string,
    excludeId: string,
  ): Promise<void> {
    const existingByEmail = await this.staffRepository.findByEmailInCampus(
      campusId,
      email,
    );
    if (existingByEmail && existingByEmail.id !== excludeId) {
      throw new ConflictException(
        `Staff with email ${email} already exists in this campus`,
      );
    }
  }

  private async checkPhoneUniqueness(
    campusId: string,
    phoneNumber: string,
    excludeId: string,
  ): Promise<void> {
    const existingByPhone =
      await this.staffRepository.findByPhoneNumberInCampus(
        campusId,
        phoneNumber,
      );
    if (existingByPhone && existingByPhone.id !== excludeId) {
      throw new ConflictException(
        `Staff with phone number ${phoneNumber} already exists in this campus`,
      );
    }
  }
}
