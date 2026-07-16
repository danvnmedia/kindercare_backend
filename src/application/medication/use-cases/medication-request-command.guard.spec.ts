import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { MedicationRequestRepository } from "@/application/medication/ports";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import {
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
} from "@/domain/medication";
import { createCampus, createMockCampusRepository } from "@/test-utils";

import { MedicationRequestCommandGuard } from "./medication-request-command.guard";
import { ReconcileMedicationRequestLifecycleUseCase } from "./reconcile-medication-request-lifecycle.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const REQUEST_ID = "55555555-5555-4555-a555-555555555555";
const NOW = new Date("2026-07-02T04:00:00.000Z");

describe("MedicationRequestCommandGuard", () => {
  let repository: jest.Mocked<MedicationRequestRepository>;
  let campusRepository: jest.Mocked<CampusRepository>;
  let guard: MedicationRequestCommandGuard;

  beforeEach(() => {
    repository = {
      transitionToTerminalIfStatusIn: jest.fn().mockResolvedValue(true),
      addTimelineEntry: jest.fn(async (entry) => entry),
      findLifecycleCandidates: jest.fn(),
    } as unknown as jest.Mocked<MedicationRequestRepository>;
    campusRepository = createMockCampusRepository();
    campusRepository.findById.mockResolvedValue(
      createCampus({ id: CAMPUS_ID, timeZone: "America/Toronto" }),
    );
    guard = new MedicationRequestCommandGuard(repository, campusRepository);
  });

  it("uses the campus timezone and expires exactly at the shared boundary", async () => {
    const request = createRequest();
    const timeZone = await guard.getCampusTimeZone(CAMPUS_ID);

    await expect(
      guard.isWorkflowAllowed(request, timeZone, NOW, {} as never),
    ).resolves.toBe(false);

    expect(repository.transitionToTerminalIfStatusIn).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: REQUEST_ID,
        campusId: CAMPUS_ID,
        sourceStatuses: [MedicationRequestStatus.SUBMITTED],
        targetStatus: MedicationRequestStatus.EXPIRED,
        effectiveAt: NOW,
        updatedAt: NOW,
      }),
      expect.anything(),
    );
    const timeline = repository.addTimelineEntry.mock.calls[0][0];
    expect(timeline.action).toBe(MedicationRequestTimelineAction.EXPIRED);
    expect(timeline.actorType).toBe(MedicationRequestTimelineActorType.SYSTEM);
    expect(timeline.actorUserId).toBeNull();
  });

  it("allows pre-boundary requests and blocks terminal requests without writes", async () => {
    await expect(
      guard.isWorkflowAllowed(
        createRequest(),
        "America/Toronto",
        new Date(NOW.getTime() - 1),
        {} as never,
      ),
    ).resolves.toBe(true);
    await expect(
      guard.isWorkflowAllowed(
        createRequest(MedicationRequestStatus.COMPLETED),
        "America/Toronto",
        NOW,
        {} as never,
      ),
    ).resolves.toBe(false);

    expect(repository.transitionToTerminalIfStatusIn).not.toHaveBeenCalled();
    expect(repository.addTimelineEntry).not.toHaveBeenCalled();
  });

  it("emits one terminal timeline when a command races reconciliation", async () => {
    repository.findLifecycleCandidates.mockResolvedValue([
      {
        request: createRequest(),
        timeZone: "America/Toronto",
      },
    ]);
    let transitioned = false;
    repository.transitionToTerminalIfStatusIn.mockImplementation(async () => {
      if (transitioned) return false;
      transitioned = true;
      return true;
    });
    const transactionRunner = {
      run: jest.fn((task) => task({} as never)),
    } as jest.Mocked<TransactionRunnerPort>;
    const reconciliation = new ReconcileMedicationRequestLifecycleUseCase(
      repository,
      transactionRunner,
    );

    const [commandAllowed, reconciliationResult] = await Promise.all([
      guard.isWorkflowAllowed(
        createRequest(),
        "America/Toronto",
        NOW,
        {} as never,
      ),
      reconciliation.execute({}, NOW),
    ]);

    expect(commandAllowed).toBe(false);
    expect(reconciliationResult.expired + reconciliationResult.skipped).toBe(1);
    expect(repository.addTimelineEntry).toHaveBeenCalledTimes(1);
  });
});

function createRequest(
  status = MedicationRequestStatus.SUBMITTED,
): MedicationRequest {
  return MedicationRequest.create(
    {
      campusId: CAMPUS_ID,
      studentId: "22222222-2222-4222-a222-222222222222",
      requesterGuardianId: "33333333-3333-4333-a333-333333333333",
      status,
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      items: [
        {
          medicationName: "Medicine",
          instructions: "Give with water.",
          timesOfDay: ["12:30"],
        },
      ],
    },
    REQUEST_ID,
  );
}
