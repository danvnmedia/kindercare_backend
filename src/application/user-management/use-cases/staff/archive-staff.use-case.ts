import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { IdentityPort } from "@/application/ports/identity.port";

/**
 * Archive Staff Use Case (Soft Delete)
 *
 * Performs soft delete by:
 * 1. Locking the Clerk user (prevents sign-in)
 * 2. Deactivating the user in database (isActive = false)
 * 3. Archiving the staff in database (isArchived = true)
 *
 * This preserves data for potential account recovery.
 */
@Injectable()
export class ArchiveStaffUseCase {
  private readonly logger = new Logger(ArchiveStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(id: string, campusId: string): Promise<Staff> {
    this.logger.log(`Archiving staff: ${id} in campus ${campusId}`);

    // Step 1: Find existing staff
    const staff = await this.staffRepository.findById(id);
    if (!staff) {
      throw new NotFoundException(`Staff with ID ${id} not found`);
    }

    // Step 2: Verify staff belongs to the specified campus
    if (staff.campusId !== campusId) {
      throw new NotFoundException(
        `Staff with ID ${id} not found in this campus`,
      );
    }

    // Step 3: Lock Clerk user (best effort - don't fail if this fails)
    if (staff.hasUserAccount()) {
      await this.lockClerkUser(staff.userId!);
    }

    // Step 3: Archive staff and deactivate user atomically
    staff.archive();

    await this.unitOfWork.run(async (tx) => {
      // Archive the staff (set isArchived = true)
      await tx.updateStaff(staff.id, {
        isArchived: true,
        updatedAt: staff.updatedAt,
      });
      this.logger.log(`Staff archived in transaction: ${id}`);

      // Deactivate linked user account if exists
      if (staff.hasUserAccount()) {
        await tx.updateUser(staff.userId!, {
          isActive: false,
        });
        this.logger.log(
          `User account deactivated in transaction for staff: ${staff.email}`,
        );
      }
    });

    this.logger.log(`Staff archived successfully: ${id}`);
    return staff;
  }

  private async lockClerkUser(userId: string): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      if (user?.clerkUid) {
        this.logger.log(`Locking Clerk identity: ${user.clerkUid}`);
        await this.identityPort.lockIdentity(user.clerkUid);
        this.logger.log(`Clerk identity locked: ${user.clerkUid}`);
      }
    } catch (error) {
      // Best effort - don't fail the archive operation if Clerk lock fails
      this.logger.warn(
        `Failed to lock Clerk user (continuing with archive): ${error.message}`,
      );
    }
  }

  private async findUserById(
    userId: string,
  ): Promise<{ clerkUid: string | null } | null> {
    try {
      const user = await this.userRepository.findById(userId);
      return user ? { clerkUid: user.clerkUid } : null;
    } catch {
      return null;
    }
  }
}
