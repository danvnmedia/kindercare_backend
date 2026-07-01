import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import { MedicationRequest } from "@/domain/medication";
import { User } from "@/domain/user-management/user.entity";

import { MedicationRequestRepository } from "../ports";
import { ParentMedicationRequestAccess } from "./parent-medication-request-access";

@Injectable()
export class GetMyMedicationRequestByIdUseCase extends ParentMedicationRequestAccess {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
    @Inject("GUARDIAN_REPOSITORY")
    guardianRepository: GuardianRepository,
  ) {
    super(guardianRepository);
  }

  async execute(
    campusId: string,
    currentUser: User,
    requestId: string,
  ): Promise<MedicationRequest> {
    const guardian = await this.resolveCurrentGuardian(campusId, currentUser);
    const medicationRequest =
      await this.medicationRequestRepository.findDetailByIdForRequesterGuardian(
        campusId,
        guardian.id.toString(),
        requestId,
      );

    if (!medicationRequest) {
      throw new NotFoundException("Medication request not found");
    }

    return medicationRequest;
  }
}
