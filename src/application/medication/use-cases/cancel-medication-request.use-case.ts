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
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
} from "@/domain/medication";
import { User } from "@/domain/user-management/user.entity";

import { MedicationRequestRepository } from "../ports";
import { ParentMedicationRequestAccess } from "./parent-medication-request-access";

export interface CancelMedicationRequestInput {
  reason?: unknown;
}

@Injectable()
export class CancelMedicationRequestUseCase extends ParentMedicationRequestAccess {
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
    input: CancelMedicationRequestInput = {},
  ): Promise<MedicationRequest> {
    const guardian = await this.resolveCurrentGuardian(campusId, currentUser);

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
        medicationRequest.cancelByParent(input.reason);
      } catch (error) {
        throw new BadRequestException((error as Error).message);
      }

      const updated =
        await this.medicationRequestRepository.updateForRequesterGuardianIfStatusIn(
          medicationRequest,
          campusId,
          guardian.id.toString(),
          [
            MedicationRequestStatus.SUBMITTED,
            MedicationRequestStatus.NEEDS_MORE_INFO,
          ],
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
          action: MedicationRequestTimelineAction.CANCELLED,
          note: medicationRequest.cancelReason,
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
