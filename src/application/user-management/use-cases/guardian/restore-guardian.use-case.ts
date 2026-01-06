import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { IdentityPort } from "@/application/ports/identity.port";

/**
 * Restore Guardian Use Case
 *
 * Restores a soft-deleted guardian by:
 * 1. Unlocking the Clerk user (allows sign-in again)
 * 2. Activating the user in database (isActive = true)
 * 3. Restoring the guardian in database (isArchived = false)
 */
@Injectable()
export class RestoreGuardianUseCase {
  private readonly logger = new Logger(RestoreGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(id: string): Promise<Guardian> {
    this.logger.log(`Restoring guardian: ${id}`);

    // Step 1: Find existing guardian
    const guardian = await this.guardianRepository.findById(id);
    if (!guardian) {
      throw new NotFoundException(`Guardian with ID ${id} not found`);
    }

    // Step 2: Verify guardian is archived
    if (!guardian.isArchived) {
      throw new BadRequestException(`Guardian with ID ${id} is not archived`);
    }

    // Step 3: Unlock Clerk user (best effort - don't fail if this fails)
    if (guardian.hasUserAccount()) {
      await this.unlockClerkUser(guardian.userId!);
    }

    // Step 4: Restore guardian and activate user atomically
    guardian.restore();

    await this.unitOfWork.run(async (tx) => {
      // Restore the guardian (set isArchived = false)
      await tx.updateGuardian(guardian.id, {
        isArchived: false,
        updatedAt: guardian.updatedAt,
      });
      this.logger.log(`Guardian restored in transaction: ${id}`);

      // Activate linked user account if exists
      if (guardian.hasUserAccount()) {
        await tx.updateUser(guardian.userId!, {
          isActive: true,
        });
        this.logger.log(
          `User account activated in transaction for guardian: ${guardian.email ?? guardian.phoneNumber}`,
        );
      }
    });

    this.logger.log(`Guardian restored successfully: ${id}`);
    return guardian;
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
