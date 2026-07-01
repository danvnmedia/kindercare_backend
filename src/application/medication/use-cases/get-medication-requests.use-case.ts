import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import {
  MedicationRequest,
  MedicationRequestStatus,
  normalizeDateOnly,
} from "@/domain/medication";

import {
  MedicationRequestRepository,
  StaffMedicationRequestListParams,
} from "../ports";

@Injectable()
export class GetMedicationRequestsUseCase {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
  ) {}

  async execute(
    campusId: string,
    params: StaffMedicationRequestListParams,
  ): Promise<PaginatedResult<MedicationRequest>> {
    this.validateParams(params);

    return this.medicationRequestRepository.findByCampusId(campusId, params);
  }

  private validateParams(params: StaffMedicationRequestListParams): void {
    if (
      params.status &&
      !Object.values(MedicationRequestStatus).includes(params.status)
    ) {
      throw new BadRequestException("Invalid medication request status");
    }

    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    try {
      fromDate = params.fromDate
        ? normalizeDateOnly(params.fromDate, "From date")
        : null;
      toDate = params.toDate
        ? normalizeDateOnly(params.toDate, "To date")
        : null;
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    if (fromDate && toDate && toDate.getTime() < fromDate.getTime()) {
      throw new BadRequestException("To date must be on or after from date");
    }
  }
}
