import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { IdentityPort } from "@/application/ports/identity.port";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";

@Injectable()
export class DeleteGuardianUseCase {
  private readonly logger = new Logger(DeleteGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting guardian: ${id}`);

      // Step 1: Verify guardian exists
      const guardian = await this.guardianRepository.findById(id);
      if (!guardian) {
        throw new NotFoundException(`Guardian with ID ${id} not found`);
      }

      // Step 2: Delete associated user account and Clerk identity (if exists)
      if (guardian.userId) {
        await this.deleteUserAccount(guardian.userId);
      }

      // Step 3: Delete guardian
      await this.guardianRepository.delete(id);

      this.logger.log(`Guardian deleted successfully: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete guardian: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async deleteUserAccount(userId: string): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);
      if (user) {
        // Delete from Clerk first
        if (user.clerkUid) {
          this.logger.log(`Deleting Clerk identity: ${user.clerkUid}`);
          await this.identityPort.deleteIdentity(user.clerkUid);
          this.logger.log(`Clerk identity deleted: ${user.clerkUid}`);
        }

        // Delete user from our database
        await this.userRepository.delete(userId);
        this.logger.log(`User account deleted: ${userId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete user account: ${error.message}`,
        error.stack,
      );
      // Don't throw - user account deletion failure shouldn't fail the entire delete
      // The guardian will still be deleted, but we log the error
    }
  }
}
