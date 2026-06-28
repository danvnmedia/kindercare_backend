import { Inject, Injectable } from "@nestjs/common";

import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { AbsenceRequest } from "@/domain/absence-request";

import { AbsenceRequestRepository } from "../ports";

@Injectable()
export class GetAbsenceRequestsUseCase {
  constructor(
    @Inject("ABSENCE_REQUEST_REPOSITORY")
    private readonly absenceRequestRepository: AbsenceRequestRepository,
  ) {}

  async execute(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<AbsenceRequest>> {
    return this.absenceRequestRepository.findByCampusId(campusId, params);
  }
}
