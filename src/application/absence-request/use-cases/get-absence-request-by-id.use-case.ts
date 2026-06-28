import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { AbsenceRequest } from "@/domain/absence-request";

import { AbsenceRequestRepository } from "../ports";

@Injectable()
export class GetAbsenceRequestByIdUseCase {
  constructor(
    @Inject("ABSENCE_REQUEST_REPOSITORY")
    private readonly absenceRequestRepository: AbsenceRequestRepository,
  ) {}

  async execute(campusId: string, id: string): Promise<AbsenceRequest> {
    const absenceRequest = await this.absenceRequestRepository.findByIdInCampus(
      campusId,
      id,
    );

    if (!absenceRequest) {
      throw new NotFoundException("Absence request not found");
    }

    return absenceRequest;
  }
}
