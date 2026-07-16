import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

import { MedicationRequestRepository } from "@/application/medication";
import { CancelMedicationRequestUseCase } from "@/application/medication/use-cases/cancel-medication-request.use-case";
import { GetMyMedicationRequestByIdUseCase } from "@/application/medication/use-cases/get-my-medication-request-by-id.use-case";
import { GetMyMedicationRequestsUseCase } from "@/application/medication/use-cases/get-my-medication-requests.use-case";
import { RespondMedicationRequestUseCase } from "@/application/medication/use-cases/respond-medication-request.use-case";
import { MedicationRequestCommandGuard } from "@/application/medication/use-cases/medication-request-command.guard";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { CampusRepository } from "@/application/campus/ports/campus.repository";
import {
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
} from "@/domain/medication";
import {
  createGuardian,
  createCampus,
  createMockCampusRepository,
  createMockGuardianRepository,
  createStudent,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

const user = createUser({
  id: "44444444-4444-4444-a444-444444444444",
});
const guardian = createGuardian({
  id: "33333333-3333-4333-a333-333333333333",
  userId: user.id.toString(),
});
const student = createStudent({
  id: "22222222-2222-4222-a222-222222222222",
});

function createMedicationRequest(
  status = MedicationRequestStatus.SUBMITTED,
  timelineEntries: MedicationRequestTimelineEntry[] = [],
) {
  return MedicationRequest.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      studentId: student.id.toString(),
      requesterGuardianId: guardian.id.toString(),
      requesterUserId: user.id.toString(),
      status,
      startDate: "2099-07-01",
      endDate: "2099-07-05",
      reason: "Fever after doctor visit",
      parentNotes: "Call me if vomiting occurs.",
      reviewNote:
        status === MedicationRequestStatus.NEEDS_MORE_INFO
          ? "Please confirm lunch dosage."
          : null,
      items: [
        {
          medicationName: "Antibiotic syrup",
          dosage: "5 ml",
          instructions: "Give after lunch with water.",
          timesOfDay: ["12:30"],
        },
      ],
      timelineEntries,
    },
    "55555555-5555-4555-a555-555555555555",
  );
}

describe("parent medication request use cases", () => {
  let medicationRequestRepository: jest.Mocked<MedicationRequestRepository>;
  let guardianRepository: ReturnType<typeof createMockGuardianRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let campusRepository: jest.Mocked<CampusRepository>;
  let commandGuard: MedicationRequestCommandGuard;

  beforeEach(() => {
    medicationRequestRepository = {
      findByIdInCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findDetailByIdInCampus: jest.fn(),
      findByStudentInCampus: jest.fn(),
      findByIdForRequesterGuardian: jest.fn(),
      findDetailByIdForRequesterGuardian: jest.fn(),
      findByRequesterGuardianId: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(async (request: MedicationRequest) => request),
      updateForRequesterGuardianIfStatusIn: jest.fn(
        async (request: MedicationRequest) => request,
      ),
      updateInCampusIfStatusIn: jest.fn(),
      createOccurrences: jest.fn(),
      addTimelineEntry: jest.fn(async (entry) => entry),
      transitionToTerminalIfStatusIn: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<MedicationRequestRepository>;

    guardianRepository = createMockGuardianRepository();
    guardianRepository.findByUserIdInCampus.mockResolvedValue(guardian);
    guardianRepository.getGuardianChildrenInCampus.mockResolvedValue([
      {
        student,
        guardianRelationship: {
          id: "77777777-7777-4777-a777-777777777777",
          name: "Mother",
        },
      },
    ]);

    transactionRunner = {
      run: jest.fn(async (callback) => callback({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    campusRepository = createMockCampusRepository();
    campusRepository.findById.mockResolvedValue(
      createCampus({
        id: DEFAULT_CAMPUS_ID_A,
        timeZone: "America/Toronto",
      }),
    );
    commandGuard = new MedicationRequestCommandGuard(
      medicationRequestRepository,
      campusRepository,
    );
  });

  it("lists current guardian medication history with authorized filters", async () => {
    const request = createMedicationRequest();
    medicationRequestRepository.findByRequesterGuardianId.mockResolvedValue([
      request,
    ]);
    const useCase = new GetMyMedicationRequestsUseCase(
      medicationRequestRepository,
      guardianRepository,
    );

    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, user, {
      studentId: student.id.toString(),
      status: MedicationRequestStatus.SUBMITTED,
      fromDate: "2099-07-01",
      toDate: "2099-07-31",
    });

    expect(result).toEqual([request]);
    expect(
      medicationRequestRepository.findByRequesterGuardianId,
    ).toHaveBeenCalledWith(DEFAULT_CAMPUS_ID_A, guardian.id.toString(), {
      studentId: student.id.toString(),
      status: MedicationRequestStatus.SUBMITTED,
      fromDate: "2099-07-01",
      toDate: "2099-07-31",
    });
  });

  it("rejects parent list filters for students outside the current guardian", async () => {
    guardianRepository.getGuardianChildrenInCampus.mockResolvedValue([]);
    const useCase = new GetMyMedicationRequestsUseCase(
      medicationRequestRepository,
      guardianRepository,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, {
        studentId: student.id.toString(),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      medicationRequestRepository.findByRequesterGuardianId,
    ).not.toHaveBeenCalled();
  });

  it("returns only guardian-owned detail and preserves timeline entries", async () => {
    const timelineEntry = MedicationRequestTimelineEntry.create({
      requestId: "55555555-5555-4555-a555-555555555555",
      campusId: DEFAULT_CAMPUS_ID_A,
      actorType: MedicationRequestTimelineActorType.GUARDIAN,
      actorUserId: user.id.toString(),
      actorGuardianId: guardian.id.toString(),
      action: MedicationRequestTimelineAction.PARENT_RESPONDED,
      note: "Doctor confirmed dosage.",
    });
    const request = createMedicationRequest(
      MedicationRequestStatus.NEEDS_MORE_INFO,
      [timelineEntry],
    );
    medicationRequestRepository.findDetailByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    const useCase = new GetMyMedicationRequestByIdUseCase(
      medicationRequestRepository,
      guardianRepository,
    );

    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, user, request.id);

    expect(result.id).toBe(request.id);
    expect(result.timelineEntries[0].action).toBe(
      MedicationRequestTimelineAction.PARENT_RESPONDED,
    );
    expect(
      medicationRequestRepository.findDetailByIdForRequesterGuardian,
    ).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      guardian.id.toString(),
      request.id,
    );
    expect(
      medicationRequestRepository.transitionToTerminalIfStatusIn,
    ).not.toHaveBeenCalled();
  });

  it("returns not found for non-owned medication request detail", async () => {
    medicationRequestRepository.findDetailByIdForRequesterGuardian.mockResolvedValue(
      null,
    );
    const useCase = new GetMyMedicationRequestByIdUseCase(
      medicationRequestRepository,
      guardianRepository,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        user,
        "55555555-5555-4555-a555-555555555555",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("cancels submitted requests and appends a timeline entry", async () => {
    const request = createMedicationRequest();
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    const useCase = new CancelMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      user,
      request.id,
      {
        reason: "Medication no longer needed.",
      },
    );

    expect(result.status).toBe(MedicationRequestStatus.CANCELLED);
    expect(result.cancelReason).toBe("Medication no longer needed.");
    const timelineEntry =
      medicationRequestRepository.addTimelineEntry.mock.calls[0][0];
    expect(timelineEntry.action).toBe(
      MedicationRequestTimelineAction.CANCELLED,
    );
    expect(timelineEntry.note).toBe("Medication no longer needed.");
    expect(
      medicationRequestRepository.updateForRequesterGuardianIfStatusIn,
    ).toHaveBeenCalledWith(
      request,
      DEFAULT_CAMPUS_ID_A,
      guardian.id.toString(),
      [
        MedicationRequestStatus.SUBMITTED,
        MedicationRequestStatus.NEEDS_MORE_INFO,
      ],
      expect.any(Object),
    );
  });

  it("rejects cancellation for final request states", async () => {
    const request = createMedicationRequest(MedicationRequestStatus.APPROVED);
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    const useCase = new CancelMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, request.id, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(medicationRequestRepository.addTimelineEntry).not.toHaveBeenCalled();
    expect(
      medicationRequestRepository.updateForRequesterGuardianIfStatusIn,
    ).not.toHaveBeenCalled();
  });

  it("rejects stale cancellation races before appending history", async () => {
    const request = createMedicationRequest();
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    medicationRequestRepository.updateForRequesterGuardianIfStatusIn.mockResolvedValue(
      null,
    );
    const useCase = new CancelMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, request.id, {
        reason: "Medication no longer needed.",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(medicationRequestRepository.addTimelineEntry).not.toHaveBeenCalled();
  });

  it("expires a late cancellation before returning conflict", async () => {
    const request = createMedicationRequest();
    const now = new Date("2099-07-06T04:00:00.000Z");
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    const useCase = new CancelMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, request.id, {}, now),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      medicationRequestRepository.transitionToTerminalIfStatusIn,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: request.id,
        sourceStatuses: [MedicationRequestStatus.SUBMITTED],
        targetStatus: MedicationRequestStatus.EXPIRED,
        effectiveAt: new Date("2099-07-06T04:00:00.000Z"),
        updatedAt: now,
      }),
      expect.any(Object),
    );
    expect(
      medicationRequestRepository.updateForRequesterGuardianIfStatusIn,
    ).not.toHaveBeenCalled();
  });

  it("returns conflict for a persisted terminal parent request", async () => {
    const request = createMedicationRequest(MedicationRequestStatus.COMPLETED);
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    const useCase = new CancelMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, request.id),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      medicationRequestRepository.updateForRequesterGuardianIfStatusIn,
    ).not.toHaveBeenCalled();
  });

  it("accepts parent responses only for needs-more-info requests", async () => {
    const request = createMedicationRequest(
      MedicationRequestStatus.NEEDS_MORE_INFO,
    );
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    const useCase = new RespondMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      user,
      request.id,
      {
        message: " Doctor confirmed lunch dosage. ",
      },
    );

    expect(result.status).toBe(MedicationRequestStatus.SUBMITTED);
    const timelineEntry =
      medicationRequestRepository.addTimelineEntry.mock.calls[0][0];
    expect(timelineEntry.action).toBe(
      MedicationRequestTimelineAction.PARENT_RESPONDED,
    );
    expect(timelineEntry.note).toBe("Doctor confirmed lunch dosage.");
    expect(
      medicationRequestRepository.updateForRequesterGuardianIfStatusIn,
    ).toHaveBeenCalledWith(
      request,
      DEFAULT_CAMPUS_ID_A,
      guardian.id.toString(),
      [MedicationRequestStatus.NEEDS_MORE_INFO],
      expect.any(Object),
    );
  });

  it("rejects parent responses for submitted requests", async () => {
    const request = createMedicationRequest();
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    const useCase = new RespondMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, request.id, {
        message: "Doctor confirmed lunch dosage.",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(medicationRequestRepository.addTimelineEntry).not.toHaveBeenCalled();
    expect(
      medicationRequestRepository.updateForRequesterGuardianIfStatusIn,
    ).not.toHaveBeenCalled();
  });

  it("rejects stale parent response races before appending history", async () => {
    const request = createMedicationRequest(
      MedicationRequestStatus.NEEDS_MORE_INFO,
    );
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    medicationRequestRepository.updateForRequesterGuardianIfStatusIn.mockResolvedValue(
      null,
    );
    const useCase = new RespondMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, request.id, {
        message: "Doctor confirmed lunch dosage.",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(medicationRequestRepository.addTimelineEntry).not.toHaveBeenCalled();
  });

  it("expires a late needs-more-info response before returning conflict", async () => {
    const request = createMedicationRequest(
      MedicationRequestStatus.NEEDS_MORE_INFO,
    );
    const now = new Date("2099-07-06T04:00:00.000Z");
    medicationRequestRepository.findByIdForRequesterGuardian.mockResolvedValue(
      request,
    );
    const useCase = new RespondMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        user,
        request.id,
        { message: "Doctor confirmed dosage." },
        now,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      medicationRequestRepository.transitionToTerminalIfStatusIn,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceStatuses: [MedicationRequestStatus.NEEDS_MORE_INFO],
        effectiveAt: new Date("2099-07-06T04:00:00.000Z"),
        updatedAt: now,
      }),
      expect.any(Object),
    );
    expect(
      medicationRequestRepository.updateForRequesterGuardianIfStatusIn,
    ).not.toHaveBeenCalled();
  });
});
