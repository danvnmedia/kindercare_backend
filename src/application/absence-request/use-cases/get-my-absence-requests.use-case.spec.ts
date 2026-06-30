import { ForbiddenException } from "@nestjs/common";

import {
  AbsenceRequestRepository,
  GetMyAbsenceRequestsUseCase,
} from "@/application/absence-request";
import {
  createGuardian,
  createMockGuardianRepository,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

describe("GetMyAbsenceRequestsUseCase", () => {
  let absenceRequestRepository: jest.Mocked<AbsenceRequestRepository>;

  beforeEach(() => {
    absenceRequestRepository = {
      findByIdInCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findByRequesterGuardianId: jest.fn().mockResolvedValue([]),
      findActiveOverlaps: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as jest.Mocked<AbsenceRequestRepository>;
  });

  it("lists only the current guardian history in the selected campus", async () => {
    const user = createUser();
    const guardian = createGuardian({ userId: user.id.toString() });
    const guardianRepository = createMockGuardianRepository();
    guardianRepository.findByUserIdInCampus.mockResolvedValue(guardian);
    const useCase = new GetMyAbsenceRequestsUseCase(
      absenceRequestRepository,
      guardianRepository,
    );

    await useCase.execute(DEFAULT_CAMPUS_ID_A, user);

    expect(
      absenceRequestRepository.findByRequesterGuardianId,
    ).toHaveBeenCalledWith(DEFAULT_CAMPUS_ID_A, guardian.id.toString());
  });

  it("rejects users without a guardian profile in the selected campus", async () => {
    const user = createUser();
    const guardianRepository = createMockGuardianRepository();
    guardianRepository.findByUserIdInCampus.mockResolvedValue(null);
    const useCase = new GetMyAbsenceRequestsUseCase(
      absenceRequestRepository,
      guardianRepository,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      absenceRequestRepository.findByRequesterGuardianId,
    ).not.toHaveBeenCalled();
  });
});
