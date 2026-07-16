import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CampusRepository } from "@/application/campus/ports/campus.repository";

import { getCampusDateString } from "@/core/time/campus-time-zone";
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
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(
    campusId: string,
    input: GetHealthCenterMedicationSummaryInput = {},
    now = new Date(),
  ): Promise<HealthCenterMedicationSummaryResponse> {
    const campus = await this.campusRepository.findById(campusId);
    if (!campus) {
      throw new NotFoundException("Campus not found");
    }

    const dueDate = normalizeSummaryDate(input.date, now, campus.timeZone);
    const [requestCounts, administrationCounts] = await Promise.all([
      this.medicationRequestRepository.countHealthCenterSummaryByCampus(
        campusId,
      ),
      this.medicationAdministrationRepository.countHealthCenterSummaryByCampus(
        campusId,
        {
          dueDate,
          now,
          timeZone: campus.timeZone,
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

function normalizeSummaryDate(
  value: string | undefined,
  now: Date,
  timeZone: string,
): Date {
  try {
    return normalizeDateOnly(
      value ?? getCampusDateString(now, timeZone),
      "Date",
    );
  } catch (error) {
    throw new BadRequestException((error as Error).message);
  }
}
