import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { normalizeDateOnly } from "@/domain/medication";

import {
  MedicationAdministrationRepository,
  MedicationRequestRepository,
} from "../ports";

export interface GetHealthCenterMedicationSummaryInput {
  date?: string;
}

export interface HealthCenterMedicationSummaryLinks {
  requests: string;
  administration: string;
}

export interface HealthCenterMedicationSummary {
  pendingRequests: number;
  dueToday: number;
  overdue: number;
  needsMoreInfo: number;
  links: HealthCenterMedicationSummaryLinks;
}

export interface HealthCenterMedicationSummaryResponse {
  medication: HealthCenterMedicationSummary;
}

@Injectable()
export class GetHealthCenterMedicationSummaryUseCase {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
    @Inject("MEDICATION_ADMINISTRATION_REPOSITORY")
    private readonly medicationAdministrationRepository: MedicationAdministrationRepository,
  ) {}

  async execute(
    campusId: string,
    input: GetHealthCenterMedicationSummaryInput = {},
    now = new Date(),
  ): Promise<HealthCenterMedicationSummaryResponse> {
    const dueDate = normalizeSummaryDate(input.date, now);
    const [requestCounts, administrationCounts] = await Promise.all([
      this.medicationRequestRepository.countHealthCenterSummaryByCampus(
        campusId,
      ),
      this.medicationAdministrationRepository.countHealthCenterSummaryByCampus(
        campusId,
        {
          dueDate,
          now,
        },
      ),
    ]);

    return {
      medication: {
        pendingRequests: requestCounts.pendingRequests,
        dueToday: administrationCounts.dueToday,
        overdue: administrationCounts.overdue,
        needsMoreInfo: requestCounts.needsMoreInfo,
        links: {
          requests: "/health-center/medication-requests",
          administration: "/health-center/medication-administration",
        },
      },
    };
  }
}

function normalizeSummaryDate(value: string | undefined, now: Date): Date {
  try {
    return normalizeDateOnly(value ?? toServerDateOnly(now), "Date");
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}

function toServerDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
