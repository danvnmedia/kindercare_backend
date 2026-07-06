import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { IdentityPort } from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { UserRepository } from "../../ports/user.repository";
import {
  assertGlobalIdentityAdmin,
  getActorName,
  GLOBAL_IDENTITY_AUDIT_CAMPUS_ID,
} from "./global-identity-admin.policy";

@Injectable()
export class LockGlobalIdentityUseCase {
  private readonly logger = new Logger(LockGlobalIdentityUseCase.name);

  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly identityPort: IdentityPort,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(targetUserId: string, currentUser: User): Promise<void> {
    assertGlobalIdentityAdmin(currentUser);

    const target = await this.userRepository.findById(targetUserId);
    if (!target) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    await this.identityPort.lockIdentity(target.clerkUid);

    try {
      await this.unitOfWork.run(async (tx) => {
        await tx.updateUser(target.id, { isActive: false });
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "LOCK_GLOBAL_IDENTITY",
          targetType: "user",
          targetId: target.id,
          campusId: GLOBAL_IDENTITY_AUDIT_CAMPUS_ID,
          context: {
            actorName: getActorName(currentUser),
            targetClerkUid: target.clerkUid,
          },
          beforeValue: { isActive: target.isActive },
          afterValue: { isActive: false },
        });
      });
    } catch (error) {
      await this.identityPort.unlockIdentity(target.clerkUid).catch((err) => {
        this.logger.error(
          `Compensation FAILED: Could not unlock identity ${target.clerkUid} after lock DB failure.`,
          err?.stack,
        );
      });
      throw error;
    }
  }
}
