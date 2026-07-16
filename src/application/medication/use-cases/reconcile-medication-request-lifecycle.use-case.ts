import { Inject, Injectable, Logger } from "@nestjs/common";

import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import {
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
} from "@/domain/medication";

import {
  MedicationLifecycleCandidate,
  MedicationRequestRepository,
} from "../ports";
import {
  getMedicationRequestCompletionBoundary,
  getMedicationRequestExpirationBoundary,
} from "../medication-time-boundaries";

export const DEFAULT_MEDICATION_RECONCILIATION_LIMIT = 100;

export interface ReconcileMedicationRequestLifecycleInput {
  limit?: number;
}

export interface MedicationLifecycleReconciliationResult {
  scanned: number;
  completed: number;
  expired: number;
  skipped: number;
  failed: number;
}

type ReconciliationOutcome = "completed" | "expired" | "skipped";

@Injectable()
export class ReconcileMedicationRequestLifecycleUseCase {
  private readonly logger = new Logger(
    ReconcileMedicationRequestLifecycleUseCase.name,
  );
  private lastCandidateId?: string;

  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
    private readonly transactionRunner: TransactionRunnerPort,
  ) {}

  async execute(
    input: ReconcileMedicationRequestLifecycleInput = {},
    now = new Date(),
  ): Promise<MedicationLifecycleReconciliationResult> {
    const limit = normalizeReconciliationLimit(input.limit);
    const candidates = (
      await this.medicationRequestRepository.findLifecycleCandidates({
        now,
        limit,
        afterId: this.lastCandidateId,
      })
    ).slice(0, limit);
    const result: MedicationLifecycleReconciliationResult = {
      scanned: candidates.length,
      completed: 0,
      expired: 0,
      skipped: 0,
      failed: 0,
    };

    for (const candidate of candidates) {
      this.lastCandidateId = candidate.request.id;

      try {
        const outcome = await this.reconcileCandidate(candidate, now);
        result[outcome] += 1;
      } catch (error) {
        result.failed += 1;
        this.logger.error(
          `Medication lifecycle reconciliation failed requestId=${candidate.request.id} campusId=${candidate.request.campusId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return result;
  }

  private async reconcileCandidate(
    candidate: MedicationLifecycleCandidate,
    now: Date,
  ): Promise<ReconciliationOutcome> {
    const { request, timeZone } = candidate;

    if (
      [
        MedicationRequestStatus.SUBMITTED,
        MedicationRequestStatus.NEEDS_MORE_INFO,
      ].includes(request.status)
    ) {
      const sourceStatus = request.status;
      const effectiveAt = getMedicationRequestExpirationBoundary(
        request,
        timeZone,
      );
      if (now.getTime() < effectiveAt.getTime()) {
        return "skipped";
      }

      request.expireAt(effectiveAt, now);
      const won = await this.persistTransition(
        request,
        [sourceStatus],
        MedicationRequestStatus.EXPIRED,
        MedicationRequestTimelineAction.EXPIRED,
        effectiveAt,
        now,
      );
      return won ? "expired" : "skipped";
    }

    if (request.status === MedicationRequestStatus.APPROVED) {
      const effectiveAt = getMedicationRequestCompletionBoundary(
        request,
        timeZone,
      );
      if (now.getTime() < effectiveAt.getTime()) {
        return "skipped";
      }
      if (request.occurrences.length === 0) {
        this.logger.warn(
          `Approved medication request has no occurrences; using end-date fallback requestId=${request.id} campusId=${request.campusId}`,
        );
      }

      request.completeAt(effectiveAt, now);
      const won = await this.persistTransition(
        request,
        [MedicationRequestStatus.APPROVED],
        MedicationRequestStatus.COMPLETED,
        MedicationRequestTimelineAction.COMPLETED,
        effectiveAt,
        now,
      );
      return won ? "completed" : "skipped";
    }

    return "skipped";
  }

  private persistTransition(
    request: MedicationRequest,
    sourceStatuses: MedicationRequestStatus[],
    targetStatus:
      | MedicationRequestStatus.COMPLETED
      | MedicationRequestStatus.EXPIRED,
    timelineAction:
      | MedicationRequestTimelineAction.COMPLETED
      | MedicationRequestTimelineAction.EXPIRED,
    effectiveAt: Date,
    updatedAt: Date,
  ): Promise<boolean> {
    return this.transactionRunner.run(async (tx) => {
      const transitioned =
        await this.medicationRequestRepository.transitionToTerminalIfStatusIn(
          {
            requestId: request.id,
            campusId: request.campusId,
            sourceStatuses,
            targetStatus,
            effectiveAt,
            updatedAt,
          },
          tx,
        );

      if (!transitioned) {
        return false;
      }

      await this.medicationRequestRepository.addTimelineEntry(
        MedicationRequestTimelineEntry.create({
          requestId: request.id,
          campusId: request.campusId,
          actorType: MedicationRequestTimelineActorType.SYSTEM,
          action: timelineAction,
          createdAt: updatedAt,
          updatedAt,
        }),
        tx,
      );

      return true;
    });
  }
}

function normalizeReconciliationLimit(value?: number): number {
  const limit = value ?? DEFAULT_MEDICATION_RECONCILIATION_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error(
      "Medication reconciliation limit must be a positive integer",
    );
  }

  return limit;
}
