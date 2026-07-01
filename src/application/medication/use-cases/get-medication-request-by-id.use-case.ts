import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { MedicationRequest } from "@/domain/medication";

import { MedicationRequestRepository } from "../ports";

@Injectable()
export class GetMedicationRequestByIdUseCase {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
  ) {}

  async execute(
    campusId: string,
    requestId: string,
  ): Promise<MedicationRequest> {
    const request =
      await this.medicationRequestRepository.findDetailByIdInCampus(
        campusId,
        requestId,
      );

    if (!request) {
      throw new NotFoundException("Medication request not found");
    }

    return request;
  }
}
