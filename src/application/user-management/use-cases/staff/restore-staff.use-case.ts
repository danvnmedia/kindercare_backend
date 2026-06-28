import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { User } from "@/domain/user-management/user.entity";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { IdentityPort } from "@/application/ports/identity.port";

/**
 * Restore Staff Use Case
 *
 * Restores a soft-deleted staff by:
 * 1. Unlocking the Clerk user (allows sign-in again)
 * 2. Activating the user in database (isActive = true)
 * 3. Restoring the staff in database (isArchived = false)
 */
@Injectable()
export class RestoreStaffUseCase {
  private readonly logger = new Logger(RestoreStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(
    id: string,
    campusId: string,
    currentUser: User,
  ): Promise<Staff> {
    this.logger.log(`Restoring staff: ${id} in campus ${campusId}`);

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

    // Step 3: Verify staff is archived
    if (!staff.isArchived) {
      throw new BadRequestException(`Staff with ID ${id} is not archived`);
    }

    // Step 4: Unlock Clerk user (best effort - don't fail if this fails)
    if (staff.hasUserAccount()) {
      await this.unlockClerkUser(staff.userId!);
    }

    // Step 5: Restore staff + activate user + emit audit row atomically.
    staff.restore();

    await this.unitOfWork.run(async (tx) => {
      await tx.updateStaff(staff.id, {
        isArchived: false,
        updatedAt: staff.updatedAt,
      });
      this.logger.log(`Staff restored in transaction: ${id}`);

      if (staff.hasUserAccount()) {
        await tx.updateUser(staff.userId!, {
          isActive: true,
        });
        this.logger.log(
          `User account activated in transaction for staff: ${staff.email}`,
        );
      }

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "RESTORE_STAFF",
        targetType: "staff",
        targetId: staff.id,
        campusId: staff.campusId,
        context: { actorName: currentUser.profile?.fullName ?? null },
        beforeValue: { isArchived: true },
        afterValue: { isArchived: false },
      });
    });

    this.logger.log(`Staff restored successfully: ${id}`);
    return staff;
  }

  private async unlockClerkUser(userId: string): Promise<void> {
    try {
      const user = await this.findUserById(userId);
      if (user?.clerkUid) {
        this.logger.log(`Unlocking Clerk identity: ${user.clerkUid}`);
        await this.identityPort.unlockIdentity(user.clerkUid);
        this.logger.log(`Clerk identity unlocked: ${user.clerkUid}`);
      }
    } catch (error) {
      // Best effort - don't fail the restore operation if Clerk unlock fails
      this.logger.warn(
        `Failed to unlock Clerk user (continuing with restore): ${error.message}`,
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
