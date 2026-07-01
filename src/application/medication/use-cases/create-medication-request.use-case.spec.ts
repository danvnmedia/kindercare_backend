import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit";
import { MedicationRequestRepository } from "@/application/medication";
import { CreateMedicationRequestUseCase } from "@/application/medication/use-cases/create-medication-request.use-case";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import {
  MedicationRequest,
  MedicationRequestStatus,
} from "@/domain/medication";
import {
  createGuardian,
  createMockGuardianRepository,
  createStudent,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

describe("CreateMedicationRequestUseCase", () => {
  let medicationRequestRepository: jest.Mocked<MedicationRequestRepository>;
  let guardianRepository: ReturnType<typeof createMockGuardianRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;
  let auditRecorder: jest.Mocked<AuditEventRecorderPort>;
  let useCase: CreateMedicationRequestUseCase;

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

  const input = {
    studentId: student.id.toString(),
    startDate: "2099-07-01",
    endDate: "2099-07-05",
    reason: "Fever after doctor visit",
    parentNotes: "Call me if vomiting occurs.",
    items: [
      {
        medicationName: "Antibiotic syrup",
        dosage: "5 ml",
        instructions: "Give after lunch with water.",
        timesOfDay: ["12:30"],
        scheduleNotes: "After lunch only.",
        notes: null,
      },
    ],
  };

  beforeEach(() => {
    medicationRequestRepository = {
      findByIdInCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findDetailByIdInCampus: jest.fn(),
      findByStudentInCampus: jest.fn(),
      findByIdForRequesterGuardian: jest.fn().mockResolvedValue(null),
      findDetailByIdForRequesterGuardian: jest.fn(),
      findByRequesterGuardianId: jest.fn(),
      create: jest.fn(async (request: MedicationRequest) => request),
      update: jest.fn(),
      updateForRequesterGuardianIfStatusIn: jest.fn(),
      updateInCampusIfStatusIn: jest.fn(),
      createOccurrences: jest.fn(),
      addTimelineEntry: jest.fn(async (entry) => entry),
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
    auditRecorder = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;

    useCase = new CreateMedicationRequestUseCase(
      medicationRequestRepository,
      guardianRepository,
      transactionRunner,
      auditRecorder,
    );
  });

  it("creates a medication request for a linked guardian child", async () => {
    const result = await useCase.execute(DEFAULT_CAMPUS_ID_A, user, input);

    expect(result.studentId).toBe(student.id.toString());
    expect(result.requesterGuardianId).toBe(guardian.id.toString());
    expect(result.requesterUserId).toBe(user.id.toString());
    expect(result.status).toBe(MedicationRequestStatus.SUBMITTED);
    expect(result.items[0].timesOfDay).toEqual(["12:30"]);
    expect(guardianRepository.findByUserIdInCampus).toHaveBeenCalledWith(
      user.id.toString(),
      DEFAULT_CAMPUS_ID_A,
    );
    expect(guardianRepository.getGuardianChildrenInCampus).toHaveBeenCalledWith(
      guardian.id.toString(),
      DEFAULT_CAMPUS_ID_A,
    );
    expect(medicationRequestRepository.create).toHaveBeenCalledWith(
      result,
      expect.any(Object),
    );
    const timelineEntry =
      medicationRequestRepository.addTimelineEntry.mock.calls[0][0];
    expect(timelineEntry.requestId).toBe(result.id);
    expect(timelineEntry.campusId).toBe(DEFAULT_CAMPUS_ID_A);
    expect(timelineEntry.actorUserId).toBe(user.id.toString());
    expect(timelineEntry.actorGuardianId).toBe(guardian.id.toString());
    expect(timelineEntry.action).toBe("SUBMITTED");
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CREATE_MEDICATION_REQUEST",
        targetType: "medication_request",
        targetId: result.id,
        campusId: DEFAULT_CAMPUS_ID_A,
      }),
      expect.any(Object),
    );
  });

  it("ignores client-provided guardian identity fields", async () => {
    const forgedInput = {
      ...input,
      requesterGuardianId: "99999999-9999-4999-a999-999999999999",
      guardianId: "99999999-9999-4999-a999-999999999999",
    } as unknown as Parameters<CreateMedicationRequestUseCase["execute"]>[2];

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      user,
      forgedInput,
    );

    expect(result.requesterGuardianId).toBe(guardian.id.toString());
  });

  it("rejects requests for students not linked to the current guardian", async () => {
    guardianRepository.getGuardianChildrenInCampus.mockResolvedValue([]);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, input),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(medicationRequestRepository.create).not.toHaveBeenCalled();
    expect(auditRecorder.record).not.toHaveBeenCalled();
  });

  it("rejects requests without a current guardian profile", async () => {
    guardianRepository.findByUserIdInCampus.mockResolvedValue(null);

    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, user, input),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects missing authenticated user", async () => {
    await expect(
      useCase.execute(DEFAULT_CAMPUS_ID_A, null as never, input),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
