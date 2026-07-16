import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import {
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
  MedicationReviewAction,
  materializeAdministrationOccurrences,
} from "@/domain/medication";
import { User } from "@/domain/user-management/user.entity";

import { MedicationRequestRepository } from "../ports";
import { MedicationRequestCommandGuard } from "./medication-request-command.guard";

export interface ReviewMedicationRequestInput {
  action?: MedicationReviewAction;
  note?: unknown;
}

@Injectable()
export class ReviewMedicationRequestUseCase {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly commandGuard: MedicationRequestCommandGuard,
  ) {}

  async execute(
    campusId: string,
    requestId: string,
    input: ReviewMedicationRequestInput,
    currentUser: User,
    now = new Date(),
  ): Promise<MedicationRequest> {
    const action = input?.action;

    if (!action || !Object.values(MedicationReviewAction).includes(action)) {
      throw new BadRequestException("Invalid medication review action");
    }

    const timeZone = await this.commandGuard.getCampusTimeZone(campusId);
    const result = await this.transactionRunner.run(async (tx) => {
      const request = await this.medicationRequestRepository.findByIdInCampus(
        campusId,
        requestId,
        tx,
      );

      if (!request) {
        throw new NotFoundException("Medication request not found");
      }

      if (
        !(await this.commandGuard.isWorkflowAllowed(request, timeZone, now, tx))
      ) {
        return { kind: "blocked" } as const;
      }

      try {
        request.reviewByStaff(
          action,
          currentUser.id.toString(),
          input.note,
          now,
        );
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }

      const updated =
        await this.medicationRequestRepository.updateInCampusIfStatusIn(
          request,
          campusId,
          [MedicationRequestStatus.SUBMITTED],
          tx,
        );

      if (!updated) {
        throw new ConflictException(
          "Medication request status changed; refresh and try again",
        );
      }

      if (action === MedicationReviewAction.APPROVE) {
        const occurrences = materializeAdministrationOccurrences(request);
        await this.medicationRequestRepository.createOccurrences(
          occurrences,
          tx,
        );
      }

      await this.medicationRequestRepository.addTimelineEntry(
        MedicationRequestTimelineEntry.create({
          requestId: request.id,
          campusId,
          actorType: MedicationRequestTimelineActorType.STAFF,
          actorUserId: currentUser.id.toString(),
          action: mapReviewActionToTimelineAction(action),
          note: request.reviewNote,
          createdAt: now,
          updatedAt: now,
        }),
        tx,
      );

      const response =
        (await this.medicationRequestRepository.findByIdInCampus(
          campusId,
          request.id,
          tx,
        )) ?? updated;
      return { kind: "success", request: response } as const;
    });

    if (result.kind === "blocked") {
      throw new ConflictException("Medication request is no longer actionable");
    }

    return result.request;
  }
}

function mapReviewActionToTimelineAction(
  action: MedicationReviewAction,
): MedicationRequestTimelineAction {
  switch (action) {
    case MedicationReviewAction.APPROVE:
      return MedicationRequestTimelineAction.APPROVED;
    case MedicationReviewAction.REJECT:
      return MedicationRequestTimelineAction.REJECTED;
    case MedicationReviewAction.NEEDS_MORE_INFO:
      return MedicationRequestTimelineAction.NEEDS_MORE_INFO;
  }
}
