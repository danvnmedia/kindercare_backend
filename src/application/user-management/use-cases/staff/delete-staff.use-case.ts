import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { IdentityPort } from "@/application/ports/identity.port";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";

/**
 * Delete Staff Use Case (Hard Delete)
 *
 * Permanently deletes a staff member by:
 * 1. Deleting the Clerk identity (if exists)
 * 2. Deleting the user account (if exists)
 * 3. Deleting the staff record
 *
 * This operation is IRREVERSIBLE. For soft delete (archiving),
 * use ArchiveStaffUseCase instead.
 */
@Injectable()
export class DeleteStaffUseCase {
  private readonly logger = new Logger(DeleteStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(id: string, campusId: string): Promise<void> {
    try {
      this.logger.log(`Deleting staff: ${id} in campus ${campusId}`);

      // Step 1: Verify staff exists
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

      // Step 3: Delete associated user account and Clerk identity (if exists)
      if (staff.userId) {
        await this.deleteUserAccount(staff.userId);
      }

      // Step 3: Delete staff
      await this.staffRepository.delete(id);

      this.logger.log(`Staff deleted successfully: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete staff: ${error.message}`,
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
      // The staff will still be deleted, but we log the error
    }
  }
}
