import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { MedicationRequestRepository } from "@/application/medication";
import { GetMedicationRequestByIdUseCase } from "@/application/medication/use-cases/get-medication-request-by-id.use-case";
import { GetMedicationRequestsUseCase } from "@/application/medication/use-cases/get-medication-requests.use-case";
import { GetStudentMedicationHistoryUseCase } from "@/application/medication/use-cases/get-student-medication-history.use-case";
import { ReviewMedicationRequestUseCase } from "@/application/medication/use-cases/review-medication-request.use-case";
import { MedicationRequestCommandGuard } from "@/application/medication/use-cases/medication-request-command.guard";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationReviewAction,
} from "@/domain/medication";
import {
  createCampus,
  createMockCampusRepository,
  createStudent,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

const reviewer = createUser({
  id: "44444444-4444-4444-a444-444444444444",
});

function createMedicationRequest(
  status = MedicationRequestStatus.SUBMITTED,
): MedicationRequest {
  return MedicationRequest.create(
    {
      campusId: DEFAULT_CAMPUS_ID_A,
      studentId: "22222222-2222-4222-a222-222222222222",
      requesterGuardianId: "33333333-3333-4333-a333-333333333333",
      requesterUserId: "55555555-5555-4555-a555-555555555555",
      status,
      startDate: "2099-07-01",
      endDate: "2099-07-03",
      reason: "Fever after doctor visit",
      parentNotes: "Call me if vomiting occurs.",
      items: [
        {
          medicationName: "Antibiotic syrup",
          dosage: "5 ml",
          instructions: "Give after lunch with water.",
          timesOfDay: ["08:30", "12:30"],
        },
      ],
    },
    "66666666-6666-4666-a666-666666666666",
  );
}

describe("staff medication request use cases", () => {
  let medicationRequestRepository: jest.Mocked<MedicationRequestRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let studentRepository: jest.Mocked<StudentRepository>;
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
      findByRequesterGuardianId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateForRequesterGuardianIfStatusIn: jest.fn(),
      updateInCampusIfStatusIn: jest.fn(
        async (request: MedicationRequest) => request,
      ),
      createOccurrences: jest.fn(async (occurrences) => occurrences.length),
      addTimelineEntry: jest.fn(async (entry) => entry),
      transitionToTerminalIfStatusIn: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<MedicationRequestRepository>;

    transactionRunner = {
      run: jest.fn(async (callback) => callback({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    studentRepository = {
      findById: jest.fn().mockResolvedValue(
        createStudent({
          id: "22222222-2222-4222-a222-222222222222",
          campusId: DEFAULT_CAMPUS_ID_A,
        }),
      ),
    } as unknown as jest.Mocked<StudentRepository>;
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

  it("lists campus medication requests with staff filters", async () => {
    const expected = {
      data: [createMedicationRequest()],
      pagination: {
        count: 1,
        limit: 20,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
    medicationRequestRepository.findByCampusId.mockResolvedValue(expected);
    const useCase = new GetMedicationRequestsUseCase(
      medicationRequestRepository,
      campusRepository,
    );
    const params = {
      status: MedicationRequestStatus.SUBMITTED,
      studentId: "22222222-2222-4222-a222-222222222222",
      classId: "99999999-9999-4999-a999-999999999999",
      fromDate: "2099-07-01",
      toDate: "2099-07-31",
      search: "Antibiotic",
    };

    const now = new Date("2099-07-02T02:30:00.000Z");
    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, params, now);

    expect(result).toBe(expected);
    expect(medicationRequestRepository.findByCampusId).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      {
        ...params,
        enrollmentReferenceDate: new Date("2099-07-01T00:00:00.000Z"),
      },
    );
  });

  it("loads one campus medication request detail", async () => {
    const request = createMedicationRequest();
    medicationRequestRepository.findDetailByIdInCampus.mockResolvedValue(
      request,
    );
    const useCase = new GetMedicationRequestByIdUseCase(
      medicationRequestRepository,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, request.id),
    ).resolves.toBe(request);
    expect(
      medicationRequestRepository.findDetailByIdInCampus,
    ).toHaveBeenCalledWith(DEFAULT_CAMPUS_ID_A, request.id);
    expect(
      medicationRequestRepository.transitionToTerminalIfStatusIn,
    ).not.toHaveBeenCalled();
  });

  it("returns not found for missing staff detail", async () => {
    medicationRequestRepository.findDetailByIdInCampus.mockResolvedValue(null);
    const useCase = new GetMedicationRequestByIdUseCase(
      medicationRequestRepository,
    );

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists student medication history with student and campus scope", async () => {
    const expected = {
      data: [createMedicationRequest(MedicationRequestStatus.APPROVED)],
      pagination: {
        count: 1,
        limit: 20,
        offset: 0,
        totalPages: 1,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      },
    };
    medicationRequestRepository.findByStudentInCampus.mockResolvedValue(
      expected,
    );
    const useCase = new GetStudentMedicationHistoryUseCase(
      medicationRequestRepository,
      studentRepository,
    );
    const params = {
      status: MedicationRequestStatus.APPROVED,
      fromDate: "2099-07-01",
      toDate: "2099-07-31",
      limit: 20,
      offset: 0,
    };

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      "22222222-2222-4222-a222-222222222222",
      params,
    );

    expect(result).toBe(expected);
    expect(
      medicationRequestRepository.findByStudentInCampus,
    ).toHaveBeenCalledWith(
      DEFAULT_CAMPUS_ID_A,
      "22222222-2222-4222-a222-222222222222",
      params,
    );
  });

  it("returns not found for medication history outside the selected campus", async () => {
    studentRepository.findById.mockResolvedValueOnce(
      createStudent({
        id: "22222222-2222-4222-a222-222222222222",
        campusId: "99999999-9999-4999-a999-999999999999",
      }),
    );
    const useCase = new GetStudentMedicationHistoryUseCase(
      medicationRequestRepository,
      studentRepository,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        "22222222-2222-4222-a222-222222222222",
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      medicationRequestRepository.findByStudentInCampus,
    ).not.toHaveBeenCalled();
  });

  it("rejects invalid student medication history date ranges", async () => {
    const useCase = new GetStudentMedicationHistoryUseCase(
      medicationRequestRepository,
      studentRepository,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        "22222222-2222-4222-a222-222222222222",
        {
          fromDate: "2099-07-31",
          toDate: "2099-07-01",
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      medicationRequestRepository.findByStudentInCampus,
    ).not.toHaveBeenCalled();
  });

  it("approves submitted requests and materializes all occurrences", async () => {
    const request = createMedicationRequest();
    const now = new Date("2099-07-02T15:00:00.000Z");
    medicationRequestRepository.findByIdInCampus.mockResolvedValue(request);
    const useCase = new ReviewMedicationRequestUseCase(
      medicationRequestRepository,
      transactionRunner,
      commandGuard,
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      request.id,
      {
        action: MedicationReviewAction.APPROVE,
        note: "Approved for this week.",
      },
      reviewer,
      now,
    );

    expect(result.status).toBe(MedicationRequestStatus.APPROVED);
    expect(result.reviewedAt).toBe(now);
    expect(
      medicationRequestRepository.updateInCampusIfStatusIn,
    ).toHaveBeenCalledWith(
      request,
      DEFAULT_CAMPUS_ID_A,
      [MedicationRequestStatus.SUBMITTED],
      expect.any(Object),
    );
    expect(medicationRequestRepository.createOccurrences).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ dueTime: "08:30" }),
        expect.objectContaining({ dueTime: "12:30" }),
      ]),
      expect.any(Object),
    );
    expect(
      medicationRequestRepository.createOccurrences.mock.calls[0][0],
    ).toHaveLength(6);
    expect(
      medicationRequestRepository.addTimelineEntry.mock.calls[0][0].action,
    ).toBe(MedicationRequestTimelineAction.APPROVED);
    expect(
      medicationRequestRepository.addTimelineEntry.mock.calls[0][0].createdAt,
    ).toBe(now);
  });

  it("supports reject and needs-more-info without creating occurrences", async () => {
    const rejectRequest = createMedicationRequest();
    medicationRequestRepository.findByIdInCampus.mockResolvedValueOnce(
      rejectRequest,
    );
    const useCase = new ReviewMedicationRequestUseCase(
      medicationRequestRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        rejectRequest.id,
        { action: MedicationReviewAction.REJECT },
        reviewer,
      ),
    ).resolves.toMatchObject({ status: MedicationRequestStatus.REJECTED });

    const infoRequest = createMedicationRequest();
    medicationRequestRepository.findByIdInCampus.mockResolvedValueOnce(
      infoRequest,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        infoRequest.id,
        {
          action: MedicationReviewAction.NEEDS_MORE_INFO,
          note: "Please confirm dosage.",
        },
        reviewer,
      ),
    ).resolves.toMatchObject({
      status: MedicationRequestStatus.NEEDS_MORE_INFO,
    });

    expect(
      medicationRequestRepository.createOccurrences,
    ).not.toHaveBeenCalled();
    expect(
      medicationRequestRepository.addTimelineEntry.mock.calls.map(
        ([entry]) => entry.action,
      ),
    ).toEqual([
      MedicationRequestTimelineAction.REJECTED,
      MedicationRequestTimelineAction.NEEDS_MORE_INFO,
    ]);
  });

  it("rejects invalid or stale review transitions without partial mutation", async () => {
    const finalRequest = createMedicationRequest(
      MedicationRequestStatus.APPROVED,
    );
    medicationRequestRepository.findByIdInCampus.mockResolvedValueOnce(
      finalRequest,
    );
    const useCase = new ReviewMedicationRequestUseCase(
      medicationRequestRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        finalRequest.id,
        { action: MedicationReviewAction.REJECT },
        reviewer,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const staleRequest = createMedicationRequest();
    medicationRequestRepository.findByIdInCampus.mockResolvedValueOnce(
      staleRequest,
    );
    medicationRequestRepository.updateInCampusIfStatusIn.mockResolvedValueOnce(
      null,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        staleRequest.id,
        { action: MedicationReviewAction.APPROVE },
        reviewer,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(
      medicationRequestRepository.createOccurrences,
    ).not.toHaveBeenCalled();
    expect(medicationRequestRepository.addTimelineEntry).not.toHaveBeenCalled();
  });

  it("commits late expiration before rejecting staff review outside the transaction", async () => {
    const request = createMedicationRequest();
    const now = new Date("2099-07-04T04:00:00.000Z");
    let transactionCommitted = false;
    medicationRequestRepository.findByIdInCampus.mockResolvedValue(request);
    transactionRunner.run.mockImplementation(async (callback) => {
      const result = await callback({} as never);
      transactionCommitted = true;
      return result;
    });
    const useCase = new ReviewMedicationRequestUseCase(
      medicationRequestRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        request.id,
        { action: MedicationReviewAction.APPROVE },
        reviewer,
        now,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transactionCommitted).toBe(true);
    expect(
      medicationRequestRepository.transitionToTerminalIfStatusIn,
    ).toHaveBeenCalledWith(
      {
        requestId: request.id,
        campusId: DEFAULT_CAMPUS_ID_A,
        sourceStatuses: [MedicationRequestStatus.SUBMITTED],
        targetStatus: MedicationRequestStatus.EXPIRED,
        effectiveAt: new Date("2099-07-04T04:00:00.000Z"),
        updatedAt: now,
      },
      expect.any(Object),
    );
    const timeline =
      medicationRequestRepository.addTimelineEntry.mock.calls[0][0];
    expect(timeline).toMatchObject({
      action: MedicationRequestTimelineAction.EXPIRED,
      createdAt: now,
    });
    expect(
      medicationRequestRepository.updateInCampusIfStatusIn,
    ).not.toHaveBeenCalled();
    expect(
      medicationRequestRepository.createOccurrences,
    ).not.toHaveBeenCalled();
  });

  it.each([
    MedicationRequestStatus.REJECTED,
    MedicationRequestStatus.CANCELLED,
    MedicationRequestStatus.COMPLETED,
    MedicationRequestStatus.EXPIRED,
  ])("returns conflict for persisted terminal status %s", async (status) => {
    const request = createMedicationRequest(status);
    medicationRequestRepository.findByIdInCampus.mockResolvedValue(request);
    const useCase = new ReviewMedicationRequestUseCase(
      medicationRequestRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        request.id,
        { action: MedicationReviewAction.APPROVE },
        reviewer,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      medicationRequestRepository.updateInCampusIfStatusIn,
    ).not.toHaveBeenCalled();
  });

  it("propagates transaction failures after status update so rollback can occur", async () => {
    const request = createMedicationRequest();
    const failure = new Error("occurrence insert failed");
    medicationRequestRepository.findByIdInCampus.mockResolvedValue(request);
    medicationRequestRepository.createOccurrences.mockRejectedValue(failure);
    const useCase = new ReviewMedicationRequestUseCase(
      medicationRequestRepository,
      transactionRunner,
      commandGuard,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        request.id,
        { action: MedicationReviewAction.APPROVE },
        reviewer,
      ),
    ).rejects.toBe(failure);

    expect(
      medicationRequestRepository.updateInCampusIfStatusIn,
    ).toHaveBeenCalled();
    expect(medicationRequestRepository.addTimelineEntry).not.toHaveBeenCalled();
  });
});
