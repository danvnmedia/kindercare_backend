import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import { GuardianRepository } from "../../ports/guardian.repository";
import { Campus } from "@/domain/campus/entities/campus.entity";
import { User } from "@/domain/user-management/user.entity";

@Injectable()
export class GetCurrentGuardianCampusesUseCase {
  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
  ) {}

  async execute(currentUser: User): Promise<Campus[]> {
    if (!currentUser?.id?.toString()) {
      throw new UnauthorizedException("Authenticated user is required");
    }

    return this.guardianRepository.findActiveCampusesByUserId(
      currentUser.id.toString(),
    );
  }
}
