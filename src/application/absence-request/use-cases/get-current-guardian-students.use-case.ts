import { Inject, Injectable } from "@nestjs/common";

import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import { GuardianStudent } from "@/domain/user-management/entities/guardian.entity";
import { User } from "@/domain/user-management/user.entity";

import { CurrentGuardianResolver } from "./guardian-resolution";

@Injectable()
export class GetCurrentGuardianStudentsUseCase extends CurrentGuardianResolver {
  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    guardianRepository: GuardianRepository,
  ) {
    super(guardianRepository);
  }

  async execute(
    campusId: string,
    currentUser: User,
  ): Promise<GuardianStudent[]> {
    const guardian = await this.resolveCurrentGuardian(campusId, currentUser);

    return this.guardianRepository.getGuardianChildrenInCampus(
      guardian.id.toString(),
      campusId,
    );
  }
}
