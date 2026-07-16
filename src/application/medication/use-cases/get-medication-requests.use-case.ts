import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CampusRepository } from "@/application/campus/ports/campus.repository";

import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { getCampusDateOnly } from "@/core/time/campus-time-zone";
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
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(
    campusId: string,
    params: StaffMedicationRequestListParams,
    now = new Date(),
  ): Promise<PaginatedResult<MedicationRequest>> {
    this.validateParams(params);

    const campus = await this.campusRepository.findById(campusId);
    if (!campus) {
      throw new NotFoundException("Campus not found");
    }

    return this.medicationRequestRepository.findByCampusId(campusId, {
      ...params,
      enrollmentReferenceDate: getCampusDateOnly(now, campus.timeZone),
    });
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
