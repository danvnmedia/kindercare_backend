import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
} from "@/domain/medication";

import { getMedicationRequestExpirationBoundary } from "../medication-time-boundaries";
import { MedicationRequestRepository } from "../ports";

const TERMINAL_STATUSES = new Set<MedicationRequestStatus>([
  MedicationRequestStatus.REJECTED,
  MedicationRequestStatus.CANCELLED,
  MedicationRequestStatus.COMPLETED,
  MedicationRequestStatus.EXPIRED,
]);

@Injectable()
export class MedicationRequestCommandGuard {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async getCampusTimeZone(campusId: string): Promise<string> {
    const campus = await this.campusRepository.findById(campusId);
    if (!campus) {
      throw new NotFoundException("Campus not found");
    }

    return campus.timeZone;
  }

  async isWorkflowAllowed(
    request: MedicationRequest,
    timeZone: string,
    now: Date,
    tx: AppTransactionClient,
  ): Promise<boolean> {
    if (TERMINAL_STATUSES.has(request.status)) {
      return false;
    }

    if (
      ![
        MedicationRequestStatus.SUBMITTED,
        MedicationRequestStatus.NEEDS_MORE_INFO,
      ].includes(request.status)
    ) {
      return true;
    }

    const effectiveAt = getMedicationRequestExpirationBoundary(
      request,
      timeZone,
    );
    if (now.getTime() < effectiveAt.getTime()) {
      return true;
    }

    const sourceStatus = request.status;
    request.expireAt(effectiveAt, now);
    const transitioned =
      await this.medicationRequestRepository.transitionToTerminalIfStatusIn(
        {
          requestId: request.id,
          campusId: request.campusId,
          sourceStatuses: [sourceStatus],
          targetStatus: MedicationRequestStatus.EXPIRED,
          effectiveAt,
          updatedAt: now,
        },
        tx,
      );

    if (transitioned) {
      await this.medicationRequestRepository.addTimelineEntry(
        MedicationRequestTimelineEntry.create({
          requestId: request.id,
          campusId: request.campusId,
          actorType: MedicationRequestTimelineActorType.SYSTEM,
          action: MedicationRequestTimelineAction.EXPIRED,
          createdAt: now,
          updatedAt: now,
        }),
        tx,
      );
    }

    return false;
  }
}
