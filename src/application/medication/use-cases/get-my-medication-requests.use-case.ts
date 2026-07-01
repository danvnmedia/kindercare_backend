import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import {
  MedicationRequest,
  MedicationRequestStatus,
  normalizeDateOnly,
} from "@/domain/medication";
import { User } from "@/domain/user-management/user.entity";

import {
  MedicationRequestListFilters,
  MedicationRequestRepository,
} from "../ports";
import { ParentMedicationRequestAccess } from "./parent-medication-request-access";

export interface ListMyMedicationRequestsInput {
  studentId?: string;
  status?: MedicationRequestStatus;
  fromDate?: string;
  toDate?: string;
}

@Injectable()
export class GetMyMedicationRequestsUseCase extends ParentMedicationRequestAccess {
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
    input: ListMyMedicationRequestsInput = {},
  ): Promise<MedicationRequest[]> {
    const guardian = await this.resolveCurrentGuardian(campusId, currentUser);
    const filters = await this.normalizeFilters(
      campusId,
      guardian.id.toString(),
      input,
    );

    return this.medicationRequestRepository.findByRequesterGuardianId(
      campusId,
      guardian.id.toString(),
      filters,
    );
  }

  private async normalizeFilters(
    campusId: string,
    guardianId: string,
    input: ListMyMedicationRequestsInput,
  ): Promise<MedicationRequestListFilters> {
    if (input.studentId) {
      await this.assertGuardianCanAccessStudent(
        guardianId,
        campusId,
        input.studentId,
      );
    }

    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    try {
      fromDate = input.fromDate
        ? normalizeDateOnly(input.fromDate, "From date")
        : null;
      toDate = input.toDate ? normalizeDateOnly(input.toDate, "To date") : null;
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    if (fromDate && toDate && toDate.getTime() < fromDate.getTime()) {
      throw new BadRequestException("To date must be on or after from date");
    }

    if (
      input.status &&
      !Object.values(MedicationRequestStatus).includes(input.status)
    ) {
      throw new BadRequestException("Invalid medication request status");
    }

    return {
      studentId: input.studentId,
      status: input.status,
      fromDate: input.fromDate,
      toDate: input.toDate,
    };
  }
}
