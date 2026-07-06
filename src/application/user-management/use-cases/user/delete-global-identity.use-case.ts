import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { IdentityPort } from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { GuardianRepository } from "../../ports/guardian.repository";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";
import {
  assertGlobalIdentityAdmin,
  getActorName,
  GLOBAL_IDENTITY_AUDIT_CAMPUS_ID,
} from "./global-identity-admin.policy";

@Injectable()
export class DeleteGlobalIdentityUseCase {
  constructor(
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    private readonly identityPort: IdentityPort,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(targetUserId: string, currentUser: User): Promise<void> {
    assertGlobalIdentityAdmin(currentUser);

    const target = await this.userRepository.findById(targetUserId);
    if (!target) {
      throw new NotFoundException(`User with ID ${targetUserId} not found`);
    }

    const [linkedStaff, linkedGuardian] = await Promise.all([
      this.staffRepository.findByUserId(target.id),
      this.guardianRepository.findByUserId(target.id),
    ]);

    if (linkedStaff || linkedGuardian) {
      throw new ConflictException(
        "Cannot delete global identity while Staff or Guardian profiles remain linked",
      );
    }

    await this.identityPort.deleteIdentity(target.clerkUid);

    await this.unitOfWork.run(async (tx) => {
      await tx.recordAudit({
        actorId: currentUser.id,
        action: "DELETE_GLOBAL_IDENTITY",
        targetType: "user",
        targetId: target.id,
        campusId: GLOBAL_IDENTITY_AUDIT_CAMPUS_ID,
        context: {
          actorName: getActorName(currentUser),
          targetClerkUid: target.clerkUid,
        },
        beforeValue: { isActive: target.isActive },
        afterValue: null,
      });
      await tx.deleteUser(target.id);
    });
  }
}
