import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

import { MedicationAdministrationRepository } from "@/application/medication";
import {
  GetDailyMedicationAdministrationsUseCase,
  RecordMedicationAdministrationUseCase,
} from "@/application/medication/use-cases";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import {
  MedicationAdministrationLog,
  MedicationAdministrationOccurrence,
  MedicationAdministrationOutcome,
  MedicationAdministrationStatus,
} from "@/domain/medication";
import {
  createRole,
  createRoleAssignment,
  createUser,
  DEFAULT_CAMPUS_ID_A,
} from "@/test-utils";

const OCCURRENCE_ID = "11111111-1111-4111-a111-111111111111";
const REQUEST_ID = "22222222-2222-4222-a222-222222222222";
const ITEM_ID = "33333333-3333-4333-a333-333333333333";
const STUDENT_ID = "44444444-4444-4444-a444-444444444444";
const CLASS_ID = "55555555-5555-4555-a555-555555555555";
const RECORDER_ID = "66666666-6666-4666-a666-666666666666";
const OLD_LOG_ID = "77777777-7777-4777-a777-777777777777";
const NEW_LOG_ID = "88888888-8888-4888-a888-888888888888";

const recorder = createRecorderWithPermissions(
  "medication_administration.create",
  "medication_administration.update",
);
const recordOnlyRecorder = createRecorderWithPermissions(
  "medication_administration.create",
);
const correctionOnlyRecorder = createRecorderWithPermissions(
  "medication_administration.update",
);

function createOccurrence(
  props: Partial<
    Parameters<typeof MedicationAdministrationOccurrence.create>[0]
  > = {},
  id = OCCURRENCE_ID,
): MedicationAdministrationOccurrence {
  return MedicationAdministrationOccurrence.create(
    {
      requestId: REQUEST_ID,
      medicationItemId: ITEM_ID,
      campusId: DEFAULT_CAMPUS_ID_A,
      studentId: STUDENT_ID,
      dueDate: "2026-07-01",
      dueMinute: 750,
      ...props,
    },
    id,
  );
}

function createLog(
  props: Partial<Parameters<typeof MedicationAdministrationLog.create>[0]> = {},
  id = NEW_LOG_ID,
): MedicationAdministrationLog {
  return MedicationAdministrationLog.create(
    {
      occurrenceId: OCCURRENCE_ID,
      outcome: MedicationAdministrationOutcome.GIVEN,
      recordedByUserId: RECORDER_ID,
      recordedAt: new Date("2026-07-01T05:35:00.000Z"),
      actualMinute: 755,
      note: null,
      correctionOfLogId: null,
      ...props,
    },
    id,
  );
}

function createRecorderWithPermissions(...permissionIds: string[]) {
  return createUser({
    id: RECORDER_ID,
    roleAssignments: [
      createRoleAssignment(
        createRole({
          campusId: DEFAULT_CAMPUS_ID_A,
          permissions: permissionIds.map((permissionId) => ({
            id: permissionId,
            module: permissionId.split(".")[0],
            description: null,
            createdAt: new Date(),
          })),
        }),
        DEFAULT_CAMPUS_ID_A,
      ),
    ],
  });
}

function createQueueRow(
  occurrence: MedicationAdministrationOccurrence,
  overrides: {
    studentName?: string;
    medicationName?: string;
    latestLog?: MedicationAdministrationLog | null;
  } = {},
) {
  return {
    occurrence,
    request: {
      id: REQUEST_ID,
      parentNotes: "Call me if vomiting occurs.",
    },
    medicationItem: {
      id: occurrence.medicationItemId,
      medicationName: overrides.medicationName ?? "Antibiotic syrup",
      dosage: "5 ml",
      instructions: "Give after lunch with water.",
    },
    student: {
      id: occurrence.studentId,
      fullName: overrides.studentName ?? "Ava Nguyen",
      studentCode: "S-0001",
    },
    class: {
      id: CLASS_ID,
      name: "Sunflower",
    },
    latestLog: overrides.latestLog ?? null,
  };
}

describe("medication administration use cases", () => {
  let medicationAdministrationRepository: jest.Mocked<MedicationAdministrationRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;

  beforeEach(() => {
    medicationAdministrationRepository = {
      findDailyByCampus: jest.fn(),
      findOccurrenceByIdInCampus: jest.fn(),
      findLogByIdForOccurrence: jest.fn(),
      createLog: jest.fn(async (log) => log),
      updateOccurrenceLatestIfExpected: jest.fn(
        async (occurrence) => occurrence,
      ),
    } as unknown as jest.Mocked<MedicationAdministrationRepository>;

    transactionRunner = {
      run: jest.fn(async (callback) => callback({} as never)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
  });

  it("returns selected-date queue rows with filters and deterministic ordering", async () => {
    const noonZoe = createOccurrence(
      {
        dueMinute: 750,
        medicationItemId: "33333333-3333-4333-a333-333333333334",
      },
      "11111111-1111-4111-a111-111111111112",
    );
    const morningAva = createOccurrence(
      { dueMinute: 510 },
      "11111111-1111-4111-a111-111111111113",
    );
    const noonAva = createOccurrence(
      { dueMinute: 750 },
      "11111111-1111-4111-a111-111111111114",
    );
    medicationAdministrationRepository.findDailyByCampus.mockResolvedValue([
      createQueueRow(noonZoe, {
        studentName: "Zoe Tran",
        medicationName: "Vitamin D",
      }),
      createQueueRow(noonAva, {
        studentName: "Ava Nguyen",
        medicationName: "Antibiotic syrup",
      }),
      createQueueRow(morningAva, {
        studentName: "Ava Nguyen",
        medicationName: "Antibiotic syrup",
      }),
    ]);
    const useCase = new GetDailyMedicationAdministrationsUseCase(
      medicationAdministrationRepository,
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      {
        date: "2026-07-01",
        classId: CLASS_ID,
        studentId: STUDENT_ID,
      },
      new Date("2026-07-01T08:00:00.000Z"),
    );

    expect(
      medicationAdministrationRepository.findDailyByCampus,
    ).toHaveBeenCalledWith(DEFAULT_CAMPUS_ID_A, {
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
      classId: CLASS_ID,
      studentId: STUDENT_ID,
    });
    expect(result.map((item) => item.occurrenceId)).toEqual([
      morningAva.id,
      noonAva.id,
      noonZoe.id,
    ]);
    expect(result[0]).toMatchObject({
      dueTime: "08:30",
      status: MedicationAdministrationStatus.DUE,
      isOverdue: false,
      parentNotes: "Call me if vomiting occurs.",
    });
  });

  it("derives overdue for unrecorded past-due occurrences without requiring a log", async () => {
    medicationAdministrationRepository.findDailyByCampus.mockResolvedValue([
      createQueueRow(createOccurrence({ dueMinute: 510 })),
    ]);
    const useCase = new GetDailyMedicationAdministrationsUseCase(
      medicationAdministrationRepository,
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      { date: "2026-07-01", status: MedicationAdministrationStatus.OVERDUE },
      new Date("2026-07-01T09:00:00.000Z"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      status: MedicationAdministrationStatus.OVERDUE,
      isOverdue: true,
      latestLog: null,
      latestLogId: null,
    });
    expect(medicationAdministrationRepository.createLog).not.toHaveBeenCalled();
  });

  it("defaults omitted queue date from the server-local day", async () => {
    medicationAdministrationRepository.findDailyByCampus.mockResolvedValue([]);
    const useCase = new GetDailyMedicationAdministrationsUseCase(
      medicationAdministrationRepository,
    );

    await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      {},
      new Date(2026, 6, 1, 23, 30, 0),
    );

    expect(
      medicationAdministrationRepository.findDailyByCampus,
    ).toHaveBeenCalledWith(DEFAULT_CAMPUS_ID_A, {
      dueDate: new Date("2026-07-01T00:00:00.000Z"),
      classId: undefined,
      studentId: undefined,
    });
  });

  it("maps recorded latest outcomes as status and filters by outcome status", async () => {
    const latestLog = createLog({
      outcome: MedicationAdministrationOutcome.REFUSED,
      note: "Student refused after two attempts.",
    });
    const occurrence = createOccurrence({
      latestOutcome: MedicationAdministrationOutcome.REFUSED,
      latestLogId: latestLog.id,
      latestRecordedAt: latestLog.recordedAt,
      latestRecordedByUserId: RECORDER_ID,
      latestNote: latestLog.note,
    });
    medicationAdministrationRepository.findDailyByCampus.mockResolvedValue([
      createQueueRow(occurrence, { latestLog }),
    ]);
    const useCase = new GetDailyMedicationAdministrationsUseCase(
      medicationAdministrationRepository,
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      { date: "2026-07-01", status: MedicationAdministrationStatus.REFUSED },
      new Date("2026-07-01T09:00:00.000Z"),
    );

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(MedicationAdministrationStatus.REFUSED);
    expect(result[0].latestLog).toMatchObject({
      id: latestLog.id,
      outcome: MedicationAdministrationOutcome.REFUSED,
      note: "Student refused after two attempts.",
    });
  });

  it("appends a first GIVEN log and updates latest occurrence summary", async () => {
    const occurrence = createOccurrence();
    medicationAdministrationRepository.findOccurrenceByIdInCampus.mockResolvedValue(
      occurrence,
    );
    const useCase = new RecordMedicationAdministrationUseCase(
      medicationAdministrationRepository,
      transactionRunner,
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      occurrence.id,
      {
        outcome: MedicationAdministrationOutcome.GIVEN,
        actualTime: "12:35",
      },
      recorder,
      new Date("2026-07-01T05:35:00.000Z"),
    );

    expect(medicationAdministrationRepository.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId: occurrence.id,
        outcome: MedicationAdministrationOutcome.GIVEN,
        actualTime: "12:35",
        note: null,
      }),
      expect.any(Object),
    );
    expect(
      medicationAdministrationRepository.updateOccurrenceLatestIfExpected,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        id: occurrence.id,
        latestOutcome: MedicationAdministrationOutcome.GIVEN,
        latestLogId: expect.any(String),
      }),
      null,
      expect.any(Object),
    );
    expect(result).toMatchObject({
      occurrenceId: occurrence.id,
      status: MedicationAdministrationOutcome.GIVEN,
      latestOutcome: MedicationAdministrationOutcome.GIVEN,
    });
  });

  it("requires a note for non-given outcomes and corrections", async () => {
    const occurrence = createOccurrence();
    medicationAdministrationRepository.findOccurrenceByIdInCampus.mockResolvedValue(
      occurrence,
    );
    const useCase = new RecordMedicationAdministrationUseCase(
      medicationAdministrationRepository,
      transactionRunner,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        occurrence.id,
        {
          outcome: MedicationAdministrationOutcome.REFUSED,
          actualTime: "12:35",
        },
        recorder,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const recordedOccurrence = createOccurrence({
      latestOutcome: MedicationAdministrationOutcome.REFUSED,
      latestLogId: OLD_LOG_ID,
    });
    medicationAdministrationRepository.findOccurrenceByIdInCampus.mockResolvedValueOnce(
      recordedOccurrence,
    );
    medicationAdministrationRepository.findLogByIdForOccurrence.mockResolvedValue(
      createLog(
        {
          outcome: MedicationAdministrationOutcome.REFUSED,
          note: "Initial refused entry.",
        },
        OLD_LOG_ID,
      ),
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        recordedOccurrence.id,
        {
          outcome: MedicationAdministrationOutcome.GIVEN,
          actualTime: "12:40",
          correctionOfLogId: OLD_LOG_ID,
        },
        recorder,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(medicationAdministrationRepository.createLog).not.toHaveBeenCalled();
  });

  it("appends corrections and guards the expected latest log", async () => {
    const recordedOccurrence = createOccurrence({
      latestOutcome: MedicationAdministrationOutcome.REFUSED,
      latestLogId: OLD_LOG_ID,
      latestRecordedAt: new Date("2026-07-01T05:35:00.000Z"),
      latestRecordedByUserId: RECORDER_ID,
      latestNote: "Student refused after two attempts.",
    });
    medicationAdministrationRepository.findOccurrenceByIdInCampus.mockResolvedValue(
      recordedOccurrence,
    );
    medicationAdministrationRepository.findLogByIdForOccurrence.mockResolvedValue(
      createLog(
        {
          outcome: MedicationAdministrationOutcome.REFUSED,
          note: "Student refused after two attempts.",
        },
        OLD_LOG_ID,
      ),
    );
    const useCase = new RecordMedicationAdministrationUseCase(
      medicationAdministrationRepository,
      transactionRunner,
    );

    const result = await useCase.execute(
      DEFAULT_CAMPUS_ID_A,
      recordedOccurrence.id,
      {
        outcome: MedicationAdministrationOutcome.GIVEN,
        actualTime: "12:40",
        note: "Correcting previous refused entry.",
        correctionOfLogId: OLD_LOG_ID,
      },
      recorder,
      new Date("2026-07-01T05:40:00.000Z"),
    );

    expect(
      medicationAdministrationRepository.findLogByIdForOccurrence,
    ).toHaveBeenCalledWith(
      recordedOccurrence.id,
      OLD_LOG_ID,
      expect.any(Object),
    );
    expect(medicationAdministrationRepository.createLog).toHaveBeenCalledWith(
      expect.objectContaining({
        correctionOfLogId: OLD_LOG_ID,
        note: "Correcting previous refused entry.",
      }),
      expect.any(Object),
    );
    expect(
      medicationAdministrationRepository.updateOccurrenceLatestIfExpected,
    ).toHaveBeenCalledWith(expect.any(Object), OLD_LOG_ID, expect.any(Object));
    expect(result.status).toBe(MedicationAdministrationOutcome.GIVEN);
  });

  it("enforces create permission for first records and update permission for corrections", async () => {
    const occurrence = createOccurrence();
    medicationAdministrationRepository.findOccurrenceByIdInCampus.mockResolvedValue(
      occurrence,
    );
    const useCase = new RecordMedicationAdministrationUseCase(
      medicationAdministrationRepository,
      transactionRunner,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        occurrence.id,
        { outcome: MedicationAdministrationOutcome.GIVEN },
        correctionOnlyRecorder,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        occurrence.id,
        {
          outcome: MedicationAdministrationOutcome.GIVEN,
          note: "Correcting latest entry.",
          correctionOfLogId: OLD_LOG_ID,
        },
        recordOnlyRecorder,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(medicationAdministrationRepository.createLog).not.toHaveBeenCalled();
    expect(transactionRunner.run).not.toHaveBeenCalled();
  });

  it("returns conflict for duplicate first records and stale corrections", async () => {
    const recordedOccurrence = createOccurrence({
      latestOutcome: MedicationAdministrationOutcome.GIVEN,
      latestLogId: OLD_LOG_ID,
    });
    medicationAdministrationRepository.findOccurrenceByIdInCampus.mockResolvedValue(
      recordedOccurrence,
    );
    const useCase = new RecordMedicationAdministrationUseCase(
      medicationAdministrationRepository,
      transactionRunner,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        recordedOccurrence.id,
        { outcome: MedicationAdministrationOutcome.GIVEN },
        recorder,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        recordedOccurrence.id,
        {
          outcome: MedicationAdministrationOutcome.GIVEN,
          note: "Late correction.",
          correctionOfLogId: NEW_LOG_ID,
        },
        recorder,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(medicationAdministrationRepository.createLog).not.toHaveBeenCalled();
  });

  it("returns conflict when guarded latest update loses the race after log creation", async () => {
    const occurrence = createOccurrence();
    medicationAdministrationRepository.findOccurrenceByIdInCampus.mockResolvedValue(
      occurrence,
    );
    medicationAdministrationRepository.updateOccurrenceLatestIfExpected.mockResolvedValue(
      null,
    );
    const useCase = new RecordMedicationAdministrationUseCase(
      medicationAdministrationRepository,
      transactionRunner,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        occurrence.id,
        { outcome: MedicationAdministrationOutcome.GIVEN },
        recorder,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(medicationAdministrationRepository.createLog).toHaveBeenCalled();
  });

  it("returns not found for missing occurrences", async () => {
    medicationAdministrationRepository.findOccurrenceByIdInCampus.mockResolvedValue(
      null,
    );
    const useCase = new RecordMedicationAdministrationUseCase(
      medicationAdministrationRepository,
      transactionRunner,
    );

    await expect(
      useCase.execute(
        DEFAULT_CAMPUS_ID_A,
        OCCURRENCE_ID,
        { outcome: MedicationAdministrationOutcome.GIVEN },
        recorder,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
