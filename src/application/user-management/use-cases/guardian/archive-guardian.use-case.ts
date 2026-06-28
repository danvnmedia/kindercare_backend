import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { User } from "@/domain/user-management/user.entity";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { IdentityPort } from "@/application/ports/identity.port";

/**
 * Archive Guardian Use Case (Soft Delete)
 *
 * Performs soft delete by:
 * 1. Locking the Clerk user (prevents sign-in)
 * 2. Deactivating the user in database (isActive = false)
 * 3. Archiving the guardian in database (isArchived = true)
 *
 * This preserves data for potential account recovery.
 */
@Injectable()
export class ArchiveGuardianUseCase {
  private readonly logger = new Logger(ArchiveGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(
    id: string,
    campusId: string | undefined,
    currentUser: User,
  ): Promise<Guardian> {
    this.logger.log(`Archiving guardian: ${id}`);

    // Step 1: Find existing guardian
    const guardian = await this.guardianRepository.findById(id);
    if (!guardian) {
      throw new NotFoundException(`Guardian with ID ${id} not found`);
    }

    // Step 2: Verify guardian belongs to the specified campus (if campusId provided)
    if (campusId && guardian.campusId !== campusId) {
      throw new NotFoundException(
        `Guardian with ID ${id} not found in this campus`,
      );
    }

    // Step 3: Lock Clerk user (best effort - don't fail if this fails)
    if (guardian.hasUserAccount()) {
      await this.lockClerkUser(guardian.userId!);
    }

    // Step 4: Archive guardian + deactivate user + emit audit row atomically.
    guardian.archive();

    await this.unitOfWork.run(async (tx) => {
      await tx.updateGuardian(guardian.id, {
        isArchived: true,
        updatedAt: guardian.updatedAt,
      });
      this.logger.log(`Guardian archived in transaction: ${id}`);

      if (guardian.hasUserAccount()) {
        await tx.updateUser(guardian.userId!, {
          isActive: false,
        });
        this.logger.log(
          `User account deactivated in transaction for guardian: ${guardian.email ?? guardian.phoneNumber}`,
        );
      }

      await tx.recordAudit({
        actorId: currentUser.id,
        action: "ARCHIVE_GUARDIAN",
        targetType: "guardian",
        targetId: guardian.id,
        campusId: guardian.campusId,
        context: { actorName: currentUser.profile?.fullName ?? null },
        beforeValue: { isArchived: false },
        afterValue: { isArchived: true },
      });
    });

    this.logger.log(`Guardian archived successfully: ${id}`);
    return guardian;
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
