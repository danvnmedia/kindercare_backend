import { Inject, Injectable } from "@nestjs/common";

import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import { AbsenceRequest } from "@/domain/absence-request";
import { User } from "@/domain/user-management/user.entity";

import { AbsenceRequestRepository } from "../ports";
import { CurrentGuardianResolver } from "./guardian-resolution";

@Injectable()
export class GetMyAbsenceRequestsUseCase extends CurrentGuardianResolver {
  constructor(
    @Inject("ABSENCE_REQUEST_REPOSITORY")
    private readonly absenceRequestRepository: AbsenceRequestRepository,
    @Inject("GUARDIAN_REPOSITORY")
    guardianRepository: GuardianRepository,
  ) {
    super(guardianRepository);
  }

  async execute(
    campusId: string,
    currentUser: User,
  ): Promise<AbsenceRequest[]> {
    const guardian = await this.resolveCurrentGuardian(campusId, currentUser);

    return this.absenceRequestRepository.findByRequesterGuardianId(
      campusId,
      guardian.id.toString(),
    );
  }
}
