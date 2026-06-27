import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { User } from "@/domain/user-management/user.entity";

export abstract class CurrentGuardianResolver {
  protected constructor(
    protected readonly guardianRepository: GuardianRepository,
  ) {}

  protected async resolveCurrentGuardian(
    campusId: string,
    currentUser: User,
  ): Promise<Guardian> {
    if (!currentUser?.id?.toString()) {
      throw new UnauthorizedException("Authenticated user is required");
    }

    const guardian = await this.guardianRepository.findByUserIdInCampus(
      currentUser.id.toString(),
      campusId,
    );

    if (!guardian) {
      throw new ForbiddenException(
        "Current user is not a guardian in this campus",
      );
    }

    return guardian;
  }
}
