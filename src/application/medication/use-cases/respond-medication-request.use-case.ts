import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { GuardianRepository } from "@/application/user-management/ports/guardian.repository";
import {
  MEDICATION_TEXT_MAX_LENGTH,
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
} from "@/domain/medication";
import { User } from "@/domain/user-management/user.entity";

import { MedicationRequestRepository } from "../ports";
import { ParentMedicationRequestAccess } from "./parent-medication-request-access";

export interface RespondMedicationRequestInput {
  message?: unknown;
}

@Injectable()
export class RespondMedicationRequestUseCase extends ParentMedicationRequestAccess {
  constructor(
    @Inject("MEDICATION_REQUEST_REPOSITORY")
    private readonly medicationRequestRepository: MedicationRequestRepository,
    @Inject("GUARDIAN_REPOSITORY")
    guardianRepository: GuardianRepository,
    private readonly transactionRunner: TransactionRunnerPort,
  ) {
    super(guardianRepository);
  }

  async execute(
    campusId: string,
    currentUser: User,
    requestId: string,
    input: RespondMedicationRequestInput,
  ): Promise<MedicationRequest> {
    const guardian = await this.resolveCurrentGuardian(campusId, currentUser);
    const message = normalizeParentResponseMessage(input?.message);

    return this.transactionRunner.run(async (tx) => {
      const medicationRequest =
        await this.medicationRequestRepository.findByIdForRequesterGuardian(
          campusId,
          guardian.id.toString(),
          requestId,
          tx,
        );

      if (!medicationRequest) {
        throw new NotFoundException("Medication request not found");
      }

      try {
        medicationRequest.respondToMoreInfo();
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }

      const updated =
        await this.medicationRequestRepository.updateForRequesterGuardianIfStatusIn(
          medicationRequest,
          campusId,
          guardian.id.toString(),
          [MedicationRequestStatus.NEEDS_MORE_INFO],
          tx,
        );

      if (!updated) {
        throw new ConflictException(
          "Medication request status changed; refresh and try again",
        );
      }

      await this.medicationRequestRepository.addTimelineEntry(
        MedicationRequestTimelineEntry.create({
          requestId: medicationRequest.id,
          campusId,
          actorType: MedicationRequestTimelineActorType.GUARDIAN,
          actorUserId: currentUser.id.toString(),
          actorGuardianId: guardian.id.toString(),
          action: MedicationRequestTimelineAction.PARENT_RESPONDED,
          note: message,
        }),
        tx,
      );

      return (
        (await this.medicationRequestRepository.findByIdForRequesterGuardian(
          campusId,
          guardian.id.toString(),
          medicationRequest.id,
          tx,
        )) ?? updated
      );
    });
  }
}

function normalizeParentResponseMessage(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestException("Response message is required");
  }

  if (value.length > MEDICATION_TEXT_MAX_LENGTH) {
    throw new BadRequestException(
      `Response message must be at most ${MEDICATION_TEXT_MAX_LENGTH} characters`,
    );
  }

  return value.trim();
}
