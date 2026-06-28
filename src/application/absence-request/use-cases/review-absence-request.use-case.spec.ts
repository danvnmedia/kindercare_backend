import { BadRequestException, NotFoundException } from "@nestjs/common";

import {
  AbsenceRequestRepository,
  ReviewAbsenceRequestUseCase,
} from "@/application/absence-request";
import {
  AbsenceRequest,
  AbsenceRequestStatus,
  AbsenceRequestType,
} from "@/domain/absence-request";
import { createUser, DEFAULT_CAMPUS_ID_A } from "@/test-utils";

const makeRequest = (status = AbsenceRequestStatus.PENDING) =>
  AbsenceRequest.create({
    campusId: DEFAULT_CAMPUS_ID_A,
    studentId: "22222222-2222-4222-a222-222222222222",
    requesterGuardianId: "33333333-3333-4333-a333-333333333333",
    requesterUserId: "44444444-4444-4444-a444-444444444444",
    absenceType: AbsenceRequestType.FULL_DAY,
    startDate: new Date("2099-07-10T00:00:00.000Z"),
    endDate: new Date("2099-07-10T00:00:00.000Z"),
    description: "Medical appointment",
    status,
    reviewedById:
      status === AbsenceRequestStatus.PENDING
        ? null
        : "55555555-5555-4555-a555-555555555555",
    reviewedAt:
      status === AbsenceRequestStatus.PENDING
        ? null
        : new Date("2099-07-09T00:00:00.000Z"),
  });

describe("ReviewAbsenceRequestUseCase", () => {
  let repository: jest.Mocked<AbsenceRequestRepository>;
  let useCase: ReviewAbsenceRequestUseCase;
  const user = createUser({
    id: "66666666-6666-4666-a666-666666666666",
  });

  beforeEach(() => {
    repository = {
      findByIdInCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findByRequesterGuardianId: jest.fn(),
      findActiveOverlaps: jest.fn(),
      save: jest.fn(),
      update: jest.fn(async (request: AbsenceRequest) => request),
    } as jest.Mocked<AbsenceRequestRepository>;
    useCase = new ReviewAbsenceRequestUseCase(repository);
  });

  it("approves a pending request and records reviewer metadata", async () => {
    repository.findByIdInCampus.mockResolvedValue(makeRequest());

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      "99999999-9999-4999-a999-999999999999",
      { status: AbsenceRequestStatus.APPROVED, reviewNote: " Approved " },
      user,
    );

    expect(result.status).toBe(AbsenceRequestStatus.APPROVED);
    expect(result.reviewedById).toBe(user.id.toString());
    expect(result.reviewedAt).toBeInstanceOf(Date);
    expect(result.reviewNote).toBe("Approved");
    expect(repository.update).toHaveBeenCalledWith(result);
  });

  it("rejects terminal requests without persisting changes", async () => {
    repository.findByIdInCampus.mockResolvedValue(
      makeRequest(AbsenceRequestStatus.DENIED),
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        "99999999-9999-4999-a999-999999999999",
        { status: AbsenceRequestStatus.APPROVED },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("rejects missing campus-scoped requests", async () => {
    repository.findByIdInCampus.mockResolvedValue(null);

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        "99999999-9999-4999-a999-999999999999",
        { status: AbsenceRequestStatus.APPROVED },
        user,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects overlong review notes", async () => {
    repository.findByIdInCampus.mockResolvedValue(makeRequest());

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        "99999999-9999-4999-a999-999999999999",
        {
          status: AbsenceRequestStatus.DENIED,
          reviewNote: "x".repeat(1001),
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
