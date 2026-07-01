import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  MedicationRequest,
  MedicationRequestStatus,
  normalizeDateOnly,
} from "@/domain/medication";

import {
  MedicationRequestRepository,
  StudentMedicationHistoryParams,
} from "../ports";
import { getStudentInCampusOrThrow } from "@/application/student-health/use-cases/student-health-student-scope";

@Injectable()
export class GetStudentMedicationHistoryUseCase {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(
    campusId: string,
    studentId: string,
    params: StudentMedicationHistoryParams,
  ): Promise<PaginatedResult<MedicationRequest>> {
    this.validateParams(params);
    await getStudentInCampusOrThrow(
      this.studentRepository,
      campusId,
      studentId,
    );

    return this.medicationRequestRepository.findByStudentInCampus(
      campusId,
      studentId,
      params,
    );
  }

  private validateParams(params: StudentMedicationHistoryParams): void {
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
