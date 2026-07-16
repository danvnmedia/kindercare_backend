import { BadRequestException } from "@nestjs/common";

import { CampusRepository } from "@/application/campus/ports/campus.repository";
import {
  MedicationAdministrationRepository,
  MedicationRequestRepository,
} from "@/application/medication";
import { createCampus, createMockCampusRepository } from "@/test-utils";

import { GetHealthCenterMedicationSummaryUseCase } from "./get-health-center-medication-summary.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";

describe("GetHealthCenterMedicationSummaryUseCase", () => {
  let medicationRequestRepository: jest.Mocked<MedicationRequestRepository>;
  let medicationAdministrationRepository: jest.Mocked<MedicationAdministrationRepository>;
  let campusRepository: jest.Mocked<CampusRepository>;

  beforeEach(() => {
    medicationRequestRepository = {
      countHealthCenterSummaryByCampus: jest.fn(),
    } as unknown as jest.Mocked<MedicationRequestRepository>;
    medicationAdministrationRepository = {
      countHealthCenterSummaryByCampus: jest.fn(),
    } as unknown as jest.Mocked<MedicationAdministrationRepository>;
    campusRepository = createMockCampusRepository();
    campusRepository.findById.mockResolvedValue(
      createCampus({ id: CAMPUS_ID, timeZone: "America/Toronto" }),
    );
  });

  it("returns request and administration counts plus navigation links", async () => {
    medicationRequestRepository.countHealthCenterSummaryByCampus.mockResolvedValue(
      {
        pendingRequests: 3,
        needsMoreInfo: 1,
      },
    );
    medicationAdministrationRepository.countHealthCenterSummaryByCampus.mockResolvedValue(
      {
        dueToday: 8,
        overdue: 2,
      },
    );
    const useCase = new GetHealthCenterMedicationSummaryUseCase(
      medicationRequestRepository,
      medicationAdministrationRepository,
      campusRepository,
    );
    const now = new Date("2099-07-01T10:30:00.000Z");

    const result = await useCase.execute(
      CAMPUS_ID,
      { date: "2099-07-01" },
      now,
    );

    expect(
      medicationRequestRepository.countHealthCenterSummaryByCampus,
    ).toHaveBeenCalledWith(CAMPUS_ID);
    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).toHaveBeenCalledWith(CAMPUS_ID, {
      dueDate: new Date("2099-07-01T00:00:00.000Z"),
      now,
      timeZone: "America/Toronto",
    });
    expect(result).toEqual({
      medication: {
        pendingRequests: 3,
        dueToday: 8,
        overdue: 2,
        needsMoreInfo: 1,
        links: {
          requests: "/health-center/medication-requests",
          administration: "/health-center/medication-administration",
        },
      },
    });
  });

  it("defaults omitted date from the campus-local day", async () => {
    medicationRequestRepository.countHealthCenterSummaryByCampus.mockResolvedValue(
      {
        pendingRequests: 0,
        needsMoreInfo: 0,
      },
    );
    medicationAdministrationRepository.countHealthCenterSummaryByCampus.mockResolvedValue(
      {
        dueToday: 0,
        overdue: 0,
      },
    );
    const useCase = new GetHealthCenterMedicationSummaryUseCase(
      medicationRequestRepository,
      medicationAdministrationRepository,
      campusRepository,
    );
    const now = new Date("2099-07-02T02:30:00.000Z");

    await useCase.execute(CAMPUS_ID, {}, now);

    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).toHaveBeenCalledWith(
      CAMPUS_ID,
      expect.objectContaining({
        dueDate: new Date("2099-07-01T00:00:00.000Z"),
        now,
        timeZone: "America/Toronto",
      }),
    );
  });

  it("rejects invalid dates before repository reads", async () => {
    const useCase = new GetHealthCenterMedicationSummaryUseCase(
      medicationRequestRepository,
      medicationAdministrationRepository,
      campusRepository,
    );

    await expect(
      useCase.execute(CAMPUS_ID, { date: "07-01-2099" }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      medicationRequestRepository.countHealthCenterSummaryByCampus,
    ).not.toHaveBeenCalled();
    expect(
      medicationAdministrationRepository.countHealthCenterSummaryByCampus,
    ).not.toHaveBeenCalled();
  });
});
