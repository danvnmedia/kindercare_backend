import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { IdentityPort } from "@/application/ports/identity.port";
import { UserRepository } from "../../ports/user.repository";
import { UserNotFoundException } from "../../../../domain/user-management/exceptions/user-not-found.exception";

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(id: string): Promise<void> {
    try {
      // 1. Find existing user
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw new UserNotFoundException(id);
      }

      // 2. Delete from database first
      await this.userRepository.delete(id);

      // 3. Delete from Clerk (best effort, don't fail if Clerk delete fails)
      if (user.clerkUid) {
        await this.identityPort.deleteIdentity(user.clerkUid).catch(() => {
          // Log error but don't fail the operation
          console.error(`Failed to delete Clerk user: ${user.clerkUid}`);
        });
      }
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
