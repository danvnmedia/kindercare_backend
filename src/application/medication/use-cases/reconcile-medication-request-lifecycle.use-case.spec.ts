import { MedicationRequestRepository } from "@/application/medication/ports";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import {
  MedicationAdministrationOccurrence,
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
} from "@/domain/medication";

import {
  DEFAULT_MEDICATION_RECONCILIATION_LIMIT,
  ReconcileMedicationRequestLifecycleUseCase,
} from "./reconcile-medication-request-lifecycle.use-case";

const NOW = new Date("2026-07-03T12:00:00.000Z");
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";

describe("ReconcileMedicationRequestLifecycleUseCase", () => {
  let repository: jest.Mocked<MedicationRequestRepository>;
  let transactionRunner: jest.Mocked<TransactionRunnerPort>;

  beforeEach(() => {
    repository = {
      findLifecycleCandidates: jest.fn(),
      transitionToTerminalIfStatusIn: jest.fn().mockResolvedValue(true),
      addTimelineEntry: jest.fn(async (entry) => entry),
    } as unknown as jest.Mocked<MedicationRequestRepository>;
    transactionRunner = {
      run: jest.fn((task) => task({} as never)),
    } as jest.Mocked<TransactionRunnerPort>;
  });

  it("expires and completes at effective campus-local boundaries atomically", async () => {
    const submitted = createRequest(
      "00000000-0000-4000-a000-000000000001",
      MedicationRequestStatus.SUBMITTED,
    );
    const approved = createRequest(
      "00000000-0000-4000-a000-000000000002",
      MedicationRequestStatus.APPROVED,
      createOccurrence(
        "00000000-0000-4000-a000-000000000002",
        "2026-07-02",
        600,
      ),
    );
    repository.findLifecycleCandidates.mockResolvedValue([
      { request: submitted, timeZone: "UTC" },
      { request: approved, timeZone: "UTC" },
    ]);
    const useCase = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );

    const result = await useCase.execute({}, NOW);

    expect(result).toEqual({
      scanned: 2,
      completed: 1,
      expired: 1,
      skipped: 0,
      failed: 0,
    });
    expect(repository.transitionToTerminalIfStatusIn).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        requestId: submitted.id,
        campusId: CAMPUS_ID,
        sourceStatuses: [MedicationRequestStatus.SUBMITTED],
        targetStatus: MedicationRequestStatus.EXPIRED,
        effectiveAt: new Date("2026-07-03T00:00:00.000Z"),
        updatedAt: NOW,
      }),
      expect.anything(),
    );
    expect(repository.transitionToTerminalIfStatusIn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        requestId: approved.id,
        sourceStatuses: [MedicationRequestStatus.APPROVED],
        targetStatus: MedicationRequestStatus.COMPLETED,
        effectiveAt: new Date("2026-07-02T10:00:00.000Z"),
      }),
      expect.anything(),
    );
    expect(repository.addTimelineEntry).toHaveBeenCalledTimes(2);
    expect(
      repository.addTimelineEntry.mock.calls.map(([entry]) => ({
        action: entry.action,
        actorType: entry.actorType,
      })),
    ).toEqual([
      {
        action: MedicationRequestTimelineAction.EXPIRED,
        actorType: MedicationRequestTimelineActorType.SYSTEM,
      },
      {
        action: MedicationRequestTimelineAction.COMPLETED,
        actorType: MedicationRequestTimelineActorType.SYSTEM,
      },
    ]);
  });

  it("isolates failures, continues later candidates, and balances accounting", async () => {
    const candidates = [1, 2, 3].map((number) => ({
      request: createRequest(
        `00000000-0000-4000-a000-00000000000${number}`,
        MedicationRequestStatus.SUBMITTED,
      ),
      timeZone: "UTC",
    }));
    repository.findLifecycleCandidates.mockResolvedValue(candidates);
    repository.transitionToTerminalIfStatusIn
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(true);
    const useCase = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );
    (
      useCase as unknown as {
        logger: { error: jest.Mock };
      }
    ).logger.error = jest.fn();

    const result = await useCase.execute({}, NOW);

    expect(result).toEqual({
      scanned: 3,
      completed: 0,
      expired: 2,
      skipped: 0,
      failed: 1,
    });
    expect(
      result.completed + result.expired + result.skipped + result.failed,
    ).toBe(result.scanned);
    expect(repository.transitionToTerminalIfStatusIn).toHaveBeenCalledTimes(3);
  });

  it("counts a conditional-update loser as skipped without a timeline entry", async () => {
    repository.findLifecycleCandidates.mockResolvedValue([
      {
        request: createRequest(
          "00000000-0000-4000-a000-000000000001",
          MedicationRequestStatus.SUBMITTED,
        ),
        timeZone: "UTC",
      },
    ]);
    repository.transitionToTerminalIfStatusIn.mockResolvedValue(false);
    const useCase = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );

    await expect(useCase.execute({}, NOW)).resolves.toEqual({
      scanned: 1,
      completed: 0,
      expired: 0,
      skipped: 1,
      failed: 0,
    });
    expect(repository.addTimelineEntry).not.toHaveBeenCalled();
  });

  it("logs approved requests that require the no-occurrence fallback", async () => {
    const request = createRequest(
      "00000000-0000-4000-a000-000000000001",
      MedicationRequestStatus.APPROVED,
    );
    repository.findLifecycleCandidates.mockResolvedValue([
      { request, timeZone: "UTC" },
    ]);
    const useCase = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );
    const warn = jest.fn();
    (
      useCase as unknown as {
        logger: { warn: jest.Mock };
      }
    ).logger.warn = warn;

    await useCase.execute({}, NOW);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`requestId=${request.id} campusId=${CAMPUS_ID}`),
    );
    expect(repository.transitionToTerminalIfStatusIn).toHaveBeenCalledWith(
      expect.objectContaining({
        effectiveAt: new Date("2026-07-03T00:00:00.000Z"),
      }),
      expect.anything(),
    );
  });

  it("uses a rotating stable cursor and the default bounded limit", async () => {
    const first = createRequest(
      "00000000-0000-4000-a000-000000000001",
      MedicationRequestStatus.SUBMITTED,
    );
    const second = createRequest(
      "00000000-0000-4000-a000-000000000002",
      MedicationRequestStatus.SUBMITTED,
    );
    repository.findLifecycleCandidates
      .mockResolvedValueOnce([{ request: first, timeZone: "UTC" }])
      .mockResolvedValueOnce([{ request: second, timeZone: "UTC" }]);
    const useCase = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );

    await useCase.execute({}, NOW);
    await useCase.execute({}, NOW);

    expect(repository.findLifecycleCandidates).toHaveBeenNthCalledWith(1, {
      now: NOW,
      limit: DEFAULT_MEDICATION_RECONCILIATION_LIMIT,
      afterId: undefined,
    });
    expect(repository.findLifecycleCandidates).toHaveBeenNthCalledWith(2, {
      now: NOW,
      limit: DEFAULT_MEDICATION_RECONCILIATION_LIMIT,
      afterId: first.id,
    });
  });

  it("never scans beyond an explicitly configured run limit", async () => {
    repository.findLifecycleCandidates.mockResolvedValue(
      [1, 2].map((number) => ({
        request: createRequest(
          `00000000-0000-4000-a000-00000000000${number}`,
          MedicationRequestStatus.SUBMITTED,
        ),
        timeZone: "UTC",
      })),
    );
    const useCase = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );

    const result = await useCase.execute({ limit: 1 }, NOW);

    expect(result.scanned).toBe(1);
    expect(repository.transitionToTerminalIfStatusIn).toHaveBeenCalledTimes(1);
  });

  it("allows only one concurrent worker to emit the terminal timeline", async () => {
    repository.findLifecycleCandidates
      .mockResolvedValueOnce([
        {
          request: createRequest(
            "00000000-0000-4000-a000-000000000001",
            MedicationRequestStatus.SUBMITTED,
          ),
          timeZone: "UTC",
        },
      ])
      .mockResolvedValueOnce([
        {
          request: createRequest(
            "00000000-0000-4000-a000-000000000001",
            MedicationRequestStatus.SUBMITTED,
          ),
          timeZone: "UTC",
        },
      ]);
    let transitioned = false;
    repository.transitionToTerminalIfStatusIn.mockImplementation(async () => {
      if (transitioned) return false;
      transitioned = true;
      return true;
    });
    const firstWorker = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );
    const secondWorker = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );

    const results = await Promise.all([
      firstWorker.execute({}, NOW),
      secondWorker.execute({}, NOW),
    ]);

    expect(results.map((result) => result.expired).sort()).toEqual([0, 1]);
    expect(results.map((result) => result.skipped).sort()).toEqual([0, 1]);
    expect(repository.addTimelineEntry).toHaveBeenCalledTimes(1);
  });
});

function createRequest(
  id: string,
  status: MedicationRequestStatus,
  occurrence?: MedicationAdministrationOccurrence,
): MedicationRequest {
  return MedicationRequest.create(
    {
      campusId: CAMPUS_ID,
      studentId: "22222222-2222-4222-a222-222222222222",
      requesterGuardianId: "33333333-3333-4333-a333-333333333333",
      status,
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      items: [
        {
          id: "44444444-4444-4444-a444-444444444444",
          medicationName: "Medicine",
          instructions: "Give with water.",
          timesOfDay: ["10:00"],
        },
      ],
      occurrences: occurrence ? [occurrence] : [],
    },
    id,
  );
}

function createOccurrence(
  requestId: string,
  dueDate: string,
  dueMinute: number,
): MedicationAdministrationOccurrence {
  return MedicationAdministrationOccurrence.create({
    requestId,
    medicationItemId: "44444444-4444-4444-a444-444444444444",
    campusId: CAMPUS_ID,
    studentId: "22222222-2222-4222-a222-222222222222",
    dueDate,
    dueMinute,
  });
}
